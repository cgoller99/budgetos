import "server-only";

import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import type { BetaDashboardMetrics, BetaSettings, BetaUserStatus, BetaWaitlistEntry } from "@/lib/beta/types";

export async function getBetaSettings(
  adminSupabase: BuxmeSupabaseClient,
): Promise<BetaSettings> {
  const { data, error } = await adminSupabase
    .from("beta_settings")
    .select("invite_only, max_beta_users, waitlist_enabled, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    inviteOnly: data?.invite_only ?? false,
    maxBetaUsers: data?.max_beta_users ?? null,
    waitlistEnabled: data?.waitlist_enabled ?? true,
    updatedAt: data?.updated_at ?? new Date().toISOString(),
  };
}

export async function updateBetaSettings(
  adminSupabase: BuxmeSupabaseClient,
  input: Partial<Pick<BetaSettings, "inviteOnly" | "maxBetaUsers" | "waitlistEnabled">>,
): Promise<BetaSettings> {
  const { error } = await adminSupabase
    .from("beta_settings")
    .update({
      invite_only: input.inviteOnly,
      max_beta_users: input.maxBetaUsers,
      waitlist_enabled: input.waitlistEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) {
    throw error;
  }

  return getBetaSettings(adminSupabase);
}

export async function listBetaWaitlist(
  adminSupabase: BuxmeSupabaseClient,
  status?: BetaUserStatus,
): Promise<BetaWaitlistEntry[]> {
  let query = adminSupabase
    .from("beta_waitlist")
    .select("id, email, full_name, status, source, notes, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    status: row.status as BetaUserStatus,
    source: row.source,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function updateBetaWaitlistStatus(
  adminSupabase: BuxmeSupabaseClient,
  id: string,
  status: BetaUserStatus,
): Promise<void> {
  const { error } = await adminSupabase
    .from("beta_waitlist")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function updateProfileBetaStatus(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  status: BetaUserStatus,
): Promise<void> {
  const { error } = await adminSupabase
    .from("profiles")
    .update({ beta_status: status, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) throw error;
}

export type BetaProfileSummary = {
  id: string;
  email: string | null;
  fullName: string | null;
  betaStatus: BetaUserStatus;
  createdAt: string;
};

export async function listBetaProfiles(
  adminSupabase: BuxmeSupabaseClient,
  status?: BetaUserStatus,
): Promise<BetaProfileSummary[]> {
  let query = adminSupabase
    .from("profiles")
    .select("id, email, full_name, beta_status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) {
    query = query.eq("beta_status", status);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    betaStatus: row.beta_status as BetaUserStatus,
    createdAt: row.created_at,
  }));
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

function buildDailySeries(rows: Array<{ created_at: string }>, days: number) {
  const keys = lastNDaysKeys(days);
  const counts = new Map(keys.map((key) => [key, 0]));
  for (const row of rows) {
    const key = row.created_at.slice(0, 10);
    if (counts.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return keys.map((date) => ({ date, value: counts.get(date) ?? 0 }));
}

export async function getBetaDashboardMetrics(
  adminSupabase: BuxmeSupabaseClient,
): Promise<BetaDashboardMetrics> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    pendingProfiles,
    approvedProfiles,
    rejectedProfiles,
    waitlistPending,
    feedbackRows,
    featureRows,
    profiles,
    activeProfiles,
    pageRows,
    plaidAccounts,
    paidProfiles,
    totalUsers,
  ] = await Promise.all([
    adminSupabase.from("profiles").select("*", { count: "exact", head: true }).eq("beta_status", "pending"),
    adminSupabase.from("profiles").select("*", { count: "exact", head: true }).eq("beta_status", "approved"),
    adminSupabase.from("profiles").select("*", { count: "exact", head: true }).eq("beta_status", "rejected"),
    adminSupabase.from("beta_waitlist").select("*", { count: "exact", head: true }).eq("status", "pending"),
    adminSupabase.from("admin_feedback_reports").select("report_type, status"),
    adminSupabase
      .from("admin_feedback_reports")
      .select("message")
      .eq("report_type", "feature_request")
      .limit(200),
    adminSupabase.from("profiles").select("created_at").gte("created_at", since),
    adminSupabase
      .from("profiles")
      .select("updated_at, last_active_at")
      .or(`updated_at.gte.${since},last_active_at.gte.${since}`),
    adminSupabase
      .from("admin_feedback_reports")
      .select("page_path")
      .not("page_path", "is", null)
      .limit(500),
    adminSupabase
      .from("accounts")
      .select("*", { count: "exact", head: true })
      .not("bank_connection_id", "is", null),
    adminSupabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .in("subscription_plan", ["pro", "pro_plus"]),
    adminSupabase.from("profiles").select("*", { count: "exact", head: true }),
  ]);

  const feedback = feedbackRows.data ?? [];
  const pageCounts = new Map<string, number>();
  for (const row of pageRows.data ?? []) {
    const page = row.page_path ?? "/";
    pageCounts.set(page, (pageCounts.get(page) ?? 0) + 1);
  }

  const featureCounts = new Map<string, number>();
  for (const row of featureRows.data ?? []) {
    const key = row.message.slice(0, 80);
    featureCounts.set(key, (featureCounts.get(key) ?? 0) + 1);
  }

  const activeRows = (activeProfiles.data ?? []).flatMap((row) => {
    const timestamps = [row.updated_at, row.last_active_at].filter(Boolean) as string[];
    return timestamps.map((created_at) => ({ created_at }));
  });

  const userTotal = totalUsers.count ?? 0;
  const paidTotal = paidProfiles.count ?? 0;
  const plaidTotal = plaidAccounts.count ?? 0;

  return {
    pendingBetaUsers: pendingProfiles.count ?? 0,
    approvedBetaUsers: approvedProfiles.count ?? 0,
    rejectedBetaUsers: rejectedProfiles.count ?? 0,
    waitlistPending: waitlistPending.count ?? 0,
    feedbackStats: {
      total: feedback.length,
      bugs: feedback.filter((row) => row.report_type === "bug").length,
      featureRequests: feedback.filter((row) => row.report_type === "feature_request").length,
      open: feedback.filter((row) => !["completed", "closed"].includes(row.status)).length,
    },
    featureLeaderboard: [...featureCounts.entries()]
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    dailySignups: buildDailySeries(profiles.data ?? [], 30),
    dailyActiveUsers: buildDailySeries(activeRows, 30),
    topPages: [...pageCounts.entries()]
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    plaidConnectionRate: userTotal === 0 ? 0 : Number(((plaidTotal / userTotal) * 100).toFixed(1)),
    subscriptionConversion: userTotal === 0 ? 0 : Number(((paidTotal / userTotal) * 100).toFixed(1)),
  };
}

export async function exportBetaUsersCsv(adminSupabase: BuxmeSupabaseClient): Promise<string> {
  const { data, error } = await adminSupabase
    .from("profiles")
    .select("id, email, full_name, beta_status, subscription_plan, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const header = "id,email,full_name,beta_status,subscription_plan,created_at";
  const rows = (data ?? []).map((row) =>
    [
      row.id,
      row.email ?? "",
      row.full_name ?? "",
      row.beta_status,
      row.subscription_plan,
      row.created_at,
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(","),
  );

  return [header, ...rows].join("\n");
}

export async function exportFeedbackCsv(adminSupabase: BuxmeSupabaseClient): Promise<string> {
  const { data, error } = await adminSupabase
    .from("admin_feedback_reports")
    .select(
      "id, user_email, report_type, message, category, status, priority, page_path, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  const header = "id,user_email,report_type,message,category,status,priority,page_path,created_at";
  const rows = (data ?? []).map((row) =>
    [
      row.id,
      row.user_email ?? "",
      row.report_type,
      row.message,
      row.category ?? "",
      row.status,
      row.priority,
      row.page_path ?? "",
      row.created_at,
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(","),
  );

  return [header, ...rows].join("\n");
}
