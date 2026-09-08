import type { AdminFeedbackReport, AdminRevenueMetrics } from "@/lib/admin/types";
import type {
  AiTeamCustomerVoice,
  AiTeamRevenueIntelligence,
} from "@/lib/ai-team/types";

const THEME_RULES = [
  { id: "plaid", label: "Bank connections", words: ["plaid", "bank", "connect", "sync"] },
  { id: "onboarding", label: "Onboarding", words: ["onboarding", "sign up", "signup", "setup"] },
  { id: "reports", label: "Reports & insights", words: ["report", "insight", "chart", "analytics"] },
  { id: "billing", label: "Billing & subscriptions", words: ["billing", "subscription", "checkout", "payment", "upgrade"] },
  { id: "navigation", label: "Navigation", words: ["navigation", "menu", "button", "screen", "page"] },
  { id: "performance", label: "Performance", words: ["slow", "loading", "timeout", "performance"] },
  { id: "reliability", label: "Crashes & errors", words: ["crash", "error", "broken", "failed", "failure"] },
  { id: "data", label: "Data accuracy", words: ["wrong", "missing", "duplicate", "balance", "transaction"] },
] as const;

function round(value: number, digits = 1): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function countValues(values: Array<string | null | undefined>) {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const value = raw?.trim() || "Unspecified";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Object.fromEntries(
    [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)),
  );
}

function topValues(values: Array<string | null | undefined>) {
  return Object.entries(countValues(values))
    .filter(([value]) => value !== "Unspecified")
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0, 8);
}

export function deriveRevenueIntelligence(
  metrics: AdminRevenueMetrics,
  prices: { pro: number; proPlus: number },
  targets = [1_000, 5_000, 10_000],
): AiTeamRevenueIntelligence {
  const paidUsers = metrics.proUsers + metrics.proPlusUsers;
  const arpu = paidUsers > 0 && metrics.mrr >= 0
    ? round(metrics.mrr / paidUsers, 2)
    : null;
  const freeToPaidRatio =
    metrics.freeUsers > 0 ? round(paidUsers / metrics.freeUsers, 3) : null;
  const customersNeeded = (target: number, monthlyValue: number | null) =>
    monthlyValue && monthlyValue > 0
      ? Math.max(0, Math.ceil((target - metrics.mrr) / monthlyValue))
      : null;

  return {
    ...metrics,
    generatedAt: new Date().toISOString(),
    paidUsers,
    arpu,
    freeToPaidRatio,
    proMonthlyPrice: prices.pro,
    proPlusMonthlyPrice: prices.proPlus,
    projections: targets.map((targetMrr) => ({
      targetMrr,
      blendedCustomersNeeded: customersNeeded(targetMrr, arpu),
      proCustomersNeeded: customersNeeded(targetMrr, prices.pro) ?? 0,
      proPlusCustomersNeeded: customersNeeded(targetMrr, prices.proPlus) ?? 0,
    })),
    notes: [
      metrics.available
        ? "Stripe metrics are observed read-only; no Stripe writes are performed."
        : "Stripe is unavailable. User plan counts come from Buxme profiles.",
      arpu === null
        ? "Blended ARPU needs at least one paying customer and observed MRR."
        : "Projections are directional estimates, not forecasts.",
      freeToPaidRatio === null
        ? "Free-to-paid ratio is withheld because the free-user denominator is zero."
        : "Free-to-paid ratio is paid users divided by free users.",
    ],
  };
}

export function summarizeCustomerVoice(
  reports: AdminFeedbackReport[],
  now = new Date(),
): AiTeamCustomerVoice {
  const themes = THEME_RULES.map((theme) => {
    const reportIds = reports
      .filter((report) => {
        const text = `${report.message} ${report.category ?? ""} ${report.pagePath ?? ""}`.toLowerCase();
        return theme.words.some((word) => text.includes(word));
      })
      .map((report) => report.id)
      .sort();
    return { id: theme.id, label: theme.label, count: reportIds.length, reportIds };
  })
    .filter((theme) => theme.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const investigationPrompts = themes.slice(0, 3).map(
    (theme) =>
      `Review the ${theme.count} ${theme.label.toLowerCase()} signal${theme.count === 1 ? "" : "s"} and identify a reproducible friction path.`,
  );
  if (investigationPrompts.length === 0) {
    investigationPrompts.push(
      "Collect categorized customer feedback before drawing a product conclusion.",
    );
  }

  return {
    generatedAt: now.toISOString(),
    total: reports.length,
    counts: {
      byType: countValues(reports.map((report) => report.reportType)),
      byCategory: countValues(reports.map((report) => report.category)),
      byStatus: countValues(reports.map((report) => report.status)),
      byPriority: countValues(reports.map((report) => report.priority)),
    },
    themes,
    recentSignals: [...reports]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ||
          a.id.localeCompare(b.id),
      )
      .slice(0, 12)
      .map((report) => ({
        id: report.id,
        type: report.reportType,
        priority: report.priority,
        snippet:
          report.message.length > 180
            ? `${report.message.slice(0, 177).trimEnd()}…`
            : report.message,
        pagePath: report.pagePath,
        createdAt: report.createdAt,
      })),
    frictionSurfaces: {
      paths: topValues(reports.map((report) => report.pagePath)),
      devices: topValues(reports.map((report) => report.device)),
      appVersions: topValues(reports.map((report) => report.appVersion)),
    },
    investigationPrompts,
  };
}
