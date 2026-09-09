import "server-only";

import type {
  AiTeamFounderBriefRow,
  Json,
} from "@/lib/supabase/database.types";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import type {
  AiTeamApprovalDecision,
  AiTeamCustomerVoice,
  AiTeamExecutionPacket,
  AiTeamFounderBrief,
  AiTeamFounderBriefSections,
  AiTeamProductAnalytics,
  AiTeamRevenueIntelligence,
  AiTeamRun,
  AiTeamSnapshot,
} from "@/lib/ai-team/types";

const SECTION_KEYS: Array<keyof AiTeamFounderBriefSections> = [
  "whatChanged",
  "revenue",
  "product",
  "customers",
  "reliability",
  "decisionsWaiting",
  "executionReadyWork",
  "topPriorities",
  "risks",
  "missingEvidence",
];

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function sectionsFromJson(value: Json): AiTeamFounderBriefSections {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    SECTION_KEYS.map((key) => [key, strings(record[key])]),
  ) as unknown as AiTeamFounderBriefSections;
}

export function founderBriefFromRow(row: AiTeamFounderBriefRow): AiTeamFounderBrief {
  return {
    id: row.id,
    briefDate: row.brief_date,
    generatedBy: row.generated_by,
    source: row.source,
    snapshot:
      row.snapshot && typeof row.snapshot === "object" && !Array.isArray(row.snapshot)
        ? (row.snapshot as Record<string, unknown>)
        : {},
    sections: sectionsFromJson(row.sections),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildFounderBriefSections(input: {
  snapshot: AiTeamSnapshot;
  product: AiTeamProductAnalytics;
  revenue: AiTeamRevenueIntelligence;
  voice: AiTeamCustomerVoice;
  runs: AiTeamRun[];
  approvalRuns: AiTeamRun[];
  decisions: AiTeamApprovalDecision[];
  packets: AiTeamExecutionPacket[];
}): AiTeamFounderBriefSections {
  const {
    snapshot,
    product,
    revenue,
    voice,
    runs,
    approvalRuns,
    decisions,
    packets,
  } = input;
  const decidedTaskIds = new Set(decisions.map((decision) => decision.taskId));
  const waiting = approvalRuns.flatMap((run) =>
    run.tasks.filter(
      (task) => task.requiresApproval && !decidedTaskIds.has(task.id),
    ),
  );
  const unhealthy = snapshot.health.filter((check) => check.status !== "green");
  const topTheme = voice.themes[0];
  const priorities = [
    !revenue.available
      ? "Restore live revenue evidence before making revenue conclusions."
      : revenue.failedPayments > 0
        ? `Investigate ${revenue.failedPayments} open failed payment${revenue.failedPayments === 1 ? "" : "s"}.`
        : "Review revenue movement and subscription conversion evidence.",
    topTheme
      ? `Investigate the leading customer theme: ${topTheme.label} (${topTheme.count}).`
      : "Collect and categorize customer signals.",
    waiting.length > 0
      ? `Resolve ${waiting.length} approval decision${waiting.length === 1 ? "" : "s"} waiting.`
      : packets.some((packet) => packet.status === "staged")
        ? "Assign an external operator to review staged execution-ready work."
        : "Close the highest-impact product evidence gap.",
  ];

  return {
    whatChanged: [
      `${runs.length} recent AI Team run${runs.length === 1 ? "" : "s"} are in the operating window.`,
      revenue.available
        ? `${revenue.newSubscriptions} new subscription${revenue.newSubscriptions === 1 ? "" : "s"} and ${revenue.cancellations} cancellation${revenue.cancellations === 1 ? "" : "s"} are reported for 30 days.`
        : "Live Stripe revenue movement is unavailable; no subscription-motion values are inferred.",
      `${voice.total} recent customer signal${voice.total === 1 ? "" : "s"} were analyzed (up to the latest 200 reports).`,
    ],
    revenue: revenue.available
      ? [
          `MRR $${revenue.mrr.toFixed(2)}; ARR $${revenue.arr.toFixed(2)}.`,
          `${revenue.paidUsers} paid users: ${revenue.proUsers} Pro and ${revenue.proPlusUsers} Pro+.`,
          revenue.arpu === null
            ? "Blended ARPU is unavailable because its denominator is not valid."
            : `Blended ARPU is $${revenue.arpu.toFixed(2)}.`,
        ]
      : [
          "Live Stripe revenue metrics are unavailable; MRR, ARR, churn, new subscriptions, cancellations, and failed-payment totals are withheld.",
          `Profile plan counts currently show ${revenue.paidUsers} paid users: ${revenue.proUsers} Pro and ${revenue.proPlusUsers} Pro+.`,
        ],
    product: product.signals
      .filter((signal) => signal.state !== "missing")
      .slice(0, 5)
      .map((signal) => `${signal.label}: ${signal.value ?? "unavailable"}. ${signal.detail}`),
    customers: topTheme
      ? voice.themes.slice(0, 5).map((theme) => `${theme.label}: ${theme.count} signal(s).`)
      : ["No deterministic customer themes are currently observed."],
    reliability:
      unhealthy.length > 0
        ? unhealthy.map((check) => `${check.label}: ${check.status} — ${check.detail}`)
        : ["No non-green health checks are currently observed."],
    decisionsWaiting:
      waiting.length > 0
        ? waiting.map((task) => `${task.title} — ${task.approvalReason ?? "Decision required."}`)
        : ["No approval decisions are waiting."],
    executionReadyWork: packets.length > 0
      ? packets
          .filter((packet) => packet.status === "staged")
          .map((packet) => `${String(packet.task.title ?? "Approved task")} — ${packet.proposedBranchName}. Requires external operator.`)
      : ["No execution-ready packets are staged."],
    topPriorities: priorities.slice(0, 3),
    risks: [
      ...(revenue.failedPayments > 0 ? [`${revenue.failedPayments} failed payments need investigation.`] : []),
      ...unhealthy.map((check) => `${check.label} is ${check.status}.`),
      ...(waiting.length > 0 ? [`${waiting.length} gated decisions remain unresolved.`] : []),
    ].slice(0, 8),
    missingEvidence: [
      ...snapshot.unavailableSources.map((source) => `${source} snapshot source is unavailable.`),
      ...product.missingEvidence,
    ].filter((value, index, values) => values.indexOf(value) === index),
  };
}

export async function getLatestAiTeamFounderBrief(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
): Promise<AiTeamFounderBrief | null> {
  const { data, error } = await adminSupabase
    .from("ai_team_founder_briefs")
    .select("*")
    .eq("generated_by", userId)
    .order("brief_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Unable to load founder brief.", { cause: error });
  return data ? founderBriefFromRow(data) : null;
}

export async function saveAiTeamFounderBrief(
  adminSupabase: BuxmeSupabaseClient,
  generatedBy: string,
  input: Parameters<typeof buildFounderBriefSections>[0],
): Promise<AiTeamFounderBrief> {
  const briefDate = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const sections = buildFounderBriefSections(input);
  const snapshot = {
    generatedAt: now,
    aiTeamSnapshotAt: input.snapshot.generatedAt,
    productAnalyticsAt: input.product.generatedAt,
    revenueAt: input.revenue.generatedAt,
    customerVoiceAt: input.voice.generatedAt,
    runCount: input.runs.length,
    decisionCount: input.decisions.length,
    executionPacketCount: input.packets.length,
  };
  const { data, error } = await adminSupabase
    .from("ai_team_founder_briefs")
    .upsert(
      {
        brief_date: briefDate,
        generated_by: generatedBy,
        source: "deterministic",
        snapshot: snapshot as unknown as Json,
        sections: sections as unknown as Json,
        updated_at: now,
      },
      { onConflict: "generated_by,brief_date" },
    )
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("Unable to save founder brief.", { cause: error ?? undefined });
  }
  return founderBriefFromRow(data);
}
