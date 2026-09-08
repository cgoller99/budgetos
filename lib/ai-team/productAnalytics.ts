import "server-only";

import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import {
  getAdminAnalyticsMetrics,
  getAdminOverviewMetrics,
} from "@/lib/admin/metricsService";
import { getAdminPlaidMetrics } from "@/lib/admin/plaidMetricsService";
import type { AiTeamProductAnalytics, AiTeamProductSignal } from "@/lib/ai-team/types";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";

const POSTHOG_EVENTS = [
  ANALYTICS_EVENTS.ACCOUNT_CREATED,
  ANALYTICS_EVENTS.COMPLETED_ONBOARDING,
  ANALYTICS_EVENTS.CONNECTED_PLAID,
  ANALYTICS_EVENTS.PLAID_CONNECTION_FAILED,
  ANALYTICS_EVENTS.OPENED_DASHBOARD,
  ANALYTICS_EVENTS.VIEWED_REPORTS,
  ANALYTICS_EVENTS.STRIPE_CHECKOUT_STARTED,
  ANALYTICS_EVENTS.SUBSCRIPTION_PURCHASED,
  ANALYTICS_EVENTS.SUBSCRIPTION_STARTED,
  ANALYTICS_EVENTS.COMPLETED_FEEDBACK,
] as const;

type PostHogResult = {
  status: AiTeamProductAnalytics["posthog"]["status"];
  detail: string;
  counts: Record<string, number>;
};

function percentage(numerator: number, denominator: number): number | null {
  return denominator > 0
    ? Math.round((numerator / denominator) * 10_000) / 100
    : null;
}

async function getPostHogCounts(): Promise<PostHogResult> {
  const personalKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
  const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
  const host = (
    process.env.POSTHOG_API_HOST?.trim() || "https://us.posthog.com"
  ).replace(/\/$/, "");

  if (!personalKey || !projectId) {
    return {
      status: "missing_config",
      detail: "Optional POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID are not configured.",
      counts: {},
    };
  }

  try {
    const response = await fetch(`${host}/api/projects/${encodeURIComponent(projectId)}/query/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${personalKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: {
          kind: "HogQLQuery",
          query: `SELECT event, count() FROM events WHERE timestamp >= now() - INTERVAL 30 DAY AND event IN (${POSTHOG_EVENTS.map(
            (event) => `'${event.replaceAll("'", "''")}'`,
          ).join(", ")}) GROUP BY event`,
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      throw new Error(`PostHog returned ${response.status}`);
    }

    const payload = (await response.json()) as { results?: unknown };
    const rows = Array.isArray(payload.results) ? payload.results : [];
    const counts: Record<string, number> = {};
    for (const row of rows) {
      if (
        Array.isArray(row) &&
        typeof row[0] === "string" &&
        typeof row[1] === "number" &&
        Number.isFinite(row[1])
      ) {
        counts[row[0]] = row[1];
      }
    }
    return {
      status: "connected",
      detail: "Observed PostHog event counts from the last 30 days.",
      counts,
    };
  } catch (error) {
    return {
      status: "error",
      detail: error instanceof Error ? error.message : "PostHog query failed.",
      counts: {},
    };
  }
}

function eventSignal(
  posthog: PostHogResult,
  id: string,
  label: string,
  event: string,
): AiTeamProductSignal {
  if (posthog.status !== "connected") {
    return {
      id,
      label,
      state: "missing",
      value: null,
      detail: `Needs observed ${event} events from PostHog.`,
      source: "PostHog",
    };
  }
  const value = posthog.counts[event] ?? 0;
  return {
    id,
    label,
    state: "observed",
    value,
    detail: `Observed ${event} events in the last 30 days.`,
    source: "PostHog",
  };
}

export async function getAiTeamProductAnalytics(
  adminSupabase: BuxmeSupabaseClient,
): Promise<AiTeamProductAnalytics> {
  const [overview, analytics, plaid, profiles, connections, posthog] =
    await Promise.all([
      getAdminOverviewMetrics(adminSupabase),
      getAdminAnalyticsMetrics(adminSupabase),
      getAdminPlaidMetrics(adminSupabase),
      adminSupabase.from("profiles").select("id, onboarding_complete"),
      adminSupabase.from("bank_connections").select("user_id, status"),
      getPostHogCounts(),
    ]);

  if (profiles.error) throw profiles.error;
  if (connections.error) throw connections.error;

  const profileRows = profiles.data ?? [];
  const totalUsers = profileRows.length;
  const onboardedUsers = profileRows.filter((row) => row.onboarding_complete).length;
  const connectedUsers = new Set(
    (connections.data ?? [])
      .filter((row) => row.status === "connected" || row.status === "active")
      .map((row) => row.user_id),
  ).size;
  const onboardingRate = percentage(onboardedUsers, totalUsers);
  const plaidRate =
    onboardedUsers > 0 && connectedUsers <= onboardedUsers
      ? percentage(connectedUsers, onboardedUsers)
      : null;
  const checkoutCount =
    posthog.status === "connected"
      ? (posthog.counts[ANALYTICS_EVENTS.STRIPE_CHECKOUT_STARTED] ?? 0)
      : null;
  const purchasedCount =
    posthog.status === "connected"
      ? (posthog.counts[ANALYTICS_EVENTS.SUBSCRIPTION_PURCHASED] ?? 0)
      : null;

  const signals: AiTeamProductSignal[] = [
    {
      id: "onboarding",
      label: "Onboarding completion",
      state: onboardingRate === null ? "missing" : "derived",
      value: onboardingRate,
      numerator: onboardedUsers,
      denominator: totalUsers || undefined,
      rate: onboardingRate ?? undefined,
      detail:
        onboardingRate === null
          ? "No profile denominator is available."
          : `${onboardedUsers} completed of ${totalUsers} profiles.`,
      source: "Buxme profiles",
    },
    {
      id: "plaid",
      label: "Plaid-connected users",
      state: "observed",
      value: connectedUsers,
      detail: `${plaid.connectedAccounts} connected accounts are currently reported.`,
      source: "Buxme bank connections",
    },
    eventSignal(posthog, "dashboard", "Dashboard opens", ANALYTICS_EVENTS.OPENED_DASHBOARD),
    eventSignal(posthog, "reports", "Reports viewed", ANALYTICS_EVENTS.VIEWED_REPORTS),
    eventSignal(posthog, "checkout", "Checkout starts", ANALYTICS_EVENTS.STRIPE_CHECKOUT_STARTED),
    eventSignal(posthog, "purchases", "Subscription purchases", ANALYTICS_EVENTS.SUBSCRIPTION_PURCHASED),
    {
      id: "feedback",
      label: "Feedback signals",
      state: "observed",
      value: overview.totalFeedbackReports + overview.totalBugReports,
      detail: `${overview.totalFeedbackReports} feedback reports and ${overview.totalBugReports} bug reports.`,
      source: "admin_feedback_reports",
    },
  ];

  const missingEvidence = signals
    .filter((signal) => signal.state === "missing")
    .map((signal) => signal.detail);
  if (onboardedUsers === 0) {
    missingEvidence.push("Plaid conversion is withheld because there are no onboarded-user denominator records.");
  } else if (connectedUsers > onboardedUsers) {
    missingEvidence.push(
      "Plaid conversion is withheld because connected-user count exceeds the current onboarded-user cohort.",
    );
  }
  if (analytics.revenue.every((point) => point.value === 0)) {
    missingEvidence.push("Admin analytics has no observed daily revenue series.");
  }

  return {
    generatedAt: new Date().toISOString(),
    posthog: { status: posthog.status, detail: posthog.detail },
    signals,
    funnels: [
      {
        id: "activation",
        label: "Activation",
        stages: [
          { label: "Profiles", count: totalUsers, source: "Buxme profiles" },
          { label: "Onboarding completed", count: onboardedUsers, source: "Buxme profiles" },
          { label: "Plaid connected", count: connectedUsers, source: "Buxme bank connections" },
        ],
        conversionRate: onboardingRate,
      },
      {
        id: "subscription",
        label: "Checkout to subscription",
        stages: [
          { label: "Checkout started", count: checkoutCount, source: "PostHog" },
          {
            label: "Subscription purchased",
            count: posthog.status === "connected" ? purchasedCount : null,
            source: "PostHog",
          },
        ],
        conversionRate:
          checkoutCount !== null &&
          checkoutCount > 0 &&
          purchasedCount !== null
            ? percentage(purchasedCount, checkoutCount)
            : null,
      },
      {
        id: "plaid-health",
        label: "Plaid health",
        stages: [
          { label: "Onboarded users", count: onboardedUsers, source: "Buxme profiles" },
          { label: "Connected users", count: connectedUsers, source: "Buxme bank connections" },
        ],
        conversionRate: plaidRate,
      },
    ],
    missingEvidence: [...new Set(missingEvidence)],
  };
}
