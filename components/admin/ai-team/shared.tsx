"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import type {
  AiTeamAgentId,
  AiTeamTaskStatus,
} from "@/lib/ai-team/types";

export const AGENT_LABELS: Record<AiTeamAgentId, string> = {
  chief_of_staff: "Chief of Staff",
  engineering: "Engineering",
  qa: "QA",
  analytics: "Analytics",
  product: "Product",
  growth: "Growth",
  customer: "Customer",
  critic: "Critic",
};

export const AGENT_ICONS: Record<AiTeamAgentId, string> = {
  chief_of_staff: "◆",
  engineering: "⌘",
  qa: "✓",
  analytics: "⌁",
  product: "▣",
  growth: "↗",
  customer: "◌",
  critic: "◇",
};

export const BUILT_IN_PLAYBOOKS = [
  {
    title: "Launch Risk",
    description: "Find the largest evidence-backed launch risk.",
    category: "Launch",
    goalTemplate:
      "Identify the biggest launch risk using current evidence and recommend the safest next step.",
  },
  {
    title: "Plaid Health",
    description: "Review bank connection and sync evidence.",
    category: "Reliability",
    goalTemplate:
      "Analyze current Plaid connection health and produce a read-only investigation plan for the most important risk.",
  },
  {
    title: "Onboarding Conversion",
    description: "Find the clearest measurable activation opportunity.",
    category: "Product",
    goalTemplate:
      "Review onboarding and activation evidence, identify the clearest conversion opportunity, and define how to measure it.",
  },
  {
    title: "Release QA",
    description: "Plan coverage for Buxme critical flows.",
    category: "Quality",
    goalTemplate:
      "Create a focused release QA plan for Buxme critical user flows and call out evidence gaps before launch.",
  },
  {
    title: "Growth Experiment",
    description: "Design one bounded, measurable experiment.",
    category: "Growth",
    goalTemplate:
      "Design one measurable, low-risk growth experiment from current evidence with a clear success metric.",
  },
  {
    title: "Support Themes",
    description: "Synthesize available customer signals.",
    category: "Customer",
    goalTemplate:
      "Summarize the most important support and feedback themes available in current evidence without inventing missing customer context.",
  },
  {
    title: "Subscription Health",
    description: "Review subscription and payment evidence.",
    category: "Revenue",
    goalTemplate:
      "Review subscription health, churn, and failed-payment evidence and recommend a read-only next investigation.",
  },
  {
    title: "iOS Purchase QA",
    description: "Plan Apple purchase-path validation.",
    category: "Quality",
    goalTemplate:
      "Create a focused iOS purchase QA plan covering purchase, restore, entitlement sync, and failure states without executing transactions.",
  },
] as const;

export function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : "Not available";
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return "Unavailable";
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return formatDate(value);
  if (elapsed < 60_000) return "Just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return `${Math.floor(elapsed / 86_400_000)}d ago`;
}

export function modelName(value: string | null | undefined): string {
  return value?.split("/").at(-1) ?? "No model used";
}

export function statusVariant(status: AiTeamTaskStatus) {
  if (status === "completed" || status === "approved") return "success" as const;
  if (status === "failed" || status === "rejected") return "danger" as const;
  if (status === "needs_approval") return "warning" as const;
  if (status === "running") return "accent" as const;
  return "default" as const;
}

export function AgentChip({ id }: { id: AiTeamAgentId }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)]">
      <span aria-hidden>{AGENT_ICONS[id]}</span>
      {AGENT_LABELS[id]}
    </span>
  );
}

export function MiniStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-2 truncate text-2xl font-semibold tabular-nums text-[var(--foreground)]">
        {value}
      </p>
      <p className="mt-1 text-xs text-[var(--text-muted)]">{detail}</p>
    </div>
  );
}

export function DecisionBadge({
  decision,
}: {
  decision?: "approved" | "rejected";
}) {
  if (!decision) return <Badge variant="warning">Pending</Badge>;
  return (
    <Badge variant={decision === "approved" ? "success" : "danger"}>
      {decision === "approved" ? "Approved" : "Rejected"}
    </Badge>
  );
}
