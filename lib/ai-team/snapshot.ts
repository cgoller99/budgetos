import "server-only";

import { getAdminAnalyticsMetrics, getAdminOverviewMetrics } from "@/lib/admin/metricsService";
import { getAdminSystemHealth } from "@/lib/admin/healthService";
import { getAdminPlaidMetrics } from "@/lib/admin/plaidMetricsService";
import { getAdminRevenueMetrics } from "@/lib/admin/revenueService";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import type { AiTeamSnapshot } from "@/lib/ai-team/types";

type SnapshotKey = "overview" | "revenue" | "plaid" | "analytics" | "health";

function rejectedSourceNames(results: Record<SnapshotKey, PromiseSettledResult<unknown>>): string[] {
  return Object.entries(results)
    .filter(([, result]) => result.status === "rejected")
    .map(([key]) => key);
}

function fulfilled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}
function buildObservations(snapshot: Omit<AiTeamSnapshot, "observations">): string[] {
  const observations: string[] = [];
  const paidUsers = (snapshot.revenue?.proUsers ?? 0) + (snapshot.revenue?.proPlusUsers ?? 0);

  if (snapshot.overview) {
    observations.push(`${snapshot.overview.totalUsers} total users; ${snapshot.overview.activeUsers7d} active in the last 7 days.`);
    observations.push(`${snapshot.overview.totalBugReports} bug reports and ${snapshot.overview.totalFeedbackReports} feedback reports are recorded.`);
  }

  if (snapshot.revenue) {
    observations.push(`${paidUsers} paid users are currently reflected in subscription profiles.`);
    if (snapshot.revenue.available) observations.push(`Stripe reports ${snapshot.revenue.failedPayments} open failed-payment invoices.`);
  }

  if (snapshot.plaid?.available) {
    observations.push(`Plaid has ${snapshot.plaid.connectedAccounts} connected accounts with a ${snapshot.plaid.syncSuccessRate}% connection health rate.`);
  }

  const unhealthy = snapshot.health.filter((check) => check.status !== "green");
  if (unhealthy.length > 0) {
    observations.push(`${unhealthy.length} system health check${unhealthy.length === 1 ? "" : "s"} need attention.`);
  }
  return observations;
}
export async function getAiTeamSnapshot(
  adminSupabase: BuxmeSupabaseClient,
): Promise<AiTeamSnapshot> {
  const [overview, revenue, plaid, analytics, health] = await Promise.allSettled([
    getAdminOverviewMetrics(adminSupabase),
    getAdminRevenueMetrics(adminSupabase),
    getAdminPlaidMetrics(adminSupabase),
    getAdminAnalyticsMetrics(adminSupabase),
    getAdminSystemHealth(adminSupabase),
  ]);

  const results = { overview, revenue, plaid, analytics, health };
  const base = {
    generatedAt: new Date().toISOString(),
    overview: fulfilled(overview),
    revenue: fulfilled(revenue),
    plaid: fulfilled(plaid),
    analytics: fulfilled(analytics),
    health: fulfilled(health) ?? [],
    unavailableSources: rejectedSourceNames(results),
  };

  return {
    ...base,
    observations: buildObservations(base),
  };
}
