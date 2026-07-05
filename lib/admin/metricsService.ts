import "server-only";

import type {
  AdminOverviewMetrics,
  AdminAnalyticsMetrics,
  AdminAnalyticsPoint,
} from "@/lib/admin/types";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";

export type { AdminOverviewMetrics, AdminAnalyticsPoint, AdminAnalyticsMetrics } from "@/lib/admin/types";

function startOfTodayIso(): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function hoursAgoIso(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function countSince(
  adminSupabase: BuxmeSupabaseClient,
  table: string,
  since?: string,
): Promise<number> {
  let query = adminSupabase.from(table).select("*", { count: "exact", head: true });

  if (since) {
    query = query.gte("created_at", since);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function countActiveProfiles(
  adminSupabase: BuxmeSupabaseClient,
  sinceIso: string,
): Promise<number> {
  const { count, error } = await adminSupabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .or(`last_active_at.gte.${sinceIso},updated_at.gte.${sinceIso}`);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function getAdminOverviewMetrics(
  adminSupabase: BuxmeSupabaseClient,
): Promise<AdminOverviewMetrics> {
  const [
    totalUsers,
    newUsersToday,
    activeUsers24h,
    activeUsers7d,
    activeUsers30d,
    totalHouseholds,
    totalGoals,
    totalBills,
    totalAccounts,
    totalIncomePlans,
    totalFeedbackReports,
    totalBugReports,
  ] = await Promise.all([
    countSince(adminSupabase, "profiles"),
    countSince(adminSupabase, "profiles", startOfTodayIso()),
    countActiveProfiles(adminSupabase, hoursAgoIso(24)),
    countActiveProfiles(adminSupabase, daysAgoIso(7)),
    countActiveProfiles(adminSupabase, daysAgoIso(30)),
    countSince(adminSupabase, "households"),
    countSince(adminSupabase, "goals"),
    countSince(adminSupabase, "bills"),
    countSince(adminSupabase, "accounts"),
    countSince(adminSupabase, "income_plans"),
    adminSupabase
      .from("admin_feedback_reports")
      .select("*", { count: "exact", head: true })
      .eq("report_type", "feedback")
      .then(({ count, error }) => {
        if (error) throw error;
        return count ?? 0;
      }),
    adminSupabase
      .from("admin_feedback_reports")
      .select("*", { count: "exact", head: true })
      .eq("report_type", "bug")
      .then(({ count, error }) => {
        if (error) throw error;
        return count ?? 0;
      }),
  ]);

  return {
    totalUsers,
    newUsersToday,
    activeUsers24h,
    activeUsers7d,
    activeUsers30d,
    totalHouseholds,
    totalGoals,
    totalBills,
    totalAccounts,
    totalIncomePlans,
    totalFeedbackReports,
    totalBugReports,
  };
}

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

function lastNDaysKeys(days: number): string[] {
  const keys: string[] = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - index);
    keys.push(date.toISOString().slice(0, 10));
  }

  return keys;
}

function buildDailySeries(
  rows: Array<{ created_at: string }>,
  days: number,
): AdminAnalyticsPoint[] {
  const keys = lastNDaysKeys(days);
  const counts = new Map(keys.map((key) => [key, 0]));

  for (const row of rows) {
    const key = dateKey(row.created_at);
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return keys.map((date) => ({
    date,
    value: counts.get(date) ?? 0,
  }));
}

export async function getAdminAnalyticsMetrics(
  adminSupabase: BuxmeSupabaseClient,
): Promise<AdminAnalyticsMetrics> {
  const since = daysAgoIso(30);

  const [
    profiles,
    goals,
    bills,
    households,
    paidProfiles,
  ] = await Promise.all([
    adminSupabase.from("profiles").select("created_at, updated_at, last_active_at").gte("created_at", since),
    adminSupabase.from("goals").select("created_at").gte("created_at", since),
    adminSupabase.from("bills").select("created_at").gte("created_at", since),
    adminSupabase.from("households").select("created_at").gte("created_at", since),
    adminSupabase
      .from("profiles")
      .select("created_at, subscription_plan, subscription_status")
      .gte("created_at", since)
      .in("subscription_plan", ["pro", "pro_plus"]),
  ]);

  if (profiles.error) throw profiles.error;
  if (goals.error) throw goals.error;
  if (bills.error) throw bills.error;
  if (households.error) throw households.error;
  if (paidProfiles.error) throw paidProfiles.error;

  const activeRows = (profiles.data ?? []).flatMap((row) => {
    const timestamps = [row.updated_at, row.last_active_at].filter(Boolean) as string[];
    return timestamps.map((created_at) => ({ created_at }));
  });

  return {
    dailySignups: buildDailySeries(profiles.data ?? [], 30),
    dailyActiveUsers: buildDailySeries(activeRows, 30),
    subscriptionGrowth: buildDailySeries(paidProfiles.data ?? [], 30),
    revenue: lastNDaysKeys(30).map((date) => ({ date, value: 0 })),
    goalCreation: buildDailySeries(goals.data ?? [], 30),
    billCreation: buildDailySeries(bills.data ?? [], 30),
    householdGrowth: buildDailySeries(households.data ?? [], 30),
  };
}
