"use client";

import { useState } from "react";
import { Badge, Button, EmptyState, LoadingSkeleton } from "@/components/ui";
import type {
  AiTeamFounderBrief,
  AiTeamFounderBriefSections,
} from "@/lib/ai-team/types";
import { formatDate } from "./shared";

type Props = {
  brief: AiTeamFounderBrief | null;
  onRefresh: () => Promise<void>;
  refreshing: boolean;
  error: string | null;
};

const BRIEF_LABELS: Record<keyof AiTeamFounderBriefSections, string> = {
  whatChanged: "What changed",
  revenue: "Revenue",
  product: "Product",
  customers: "Customers",
  reliability: "Reliability",
  decisionsWaiting: "Decisions waiting",
  executionReadyWork: "Execution-ready work",
  topPriorities: "Top 3 priorities",
  risks: "Risks",
  missingEvidence: "Missing evidence",
};

function briefMarkdown(brief: AiTeamFounderBrief): string {
  return [
    `# Founder daily brief — ${brief.briefDate} UTC`,
    "",
    `> ${brief.source === "deterministic" ? "Deterministic, evidence-first" : "AI-assisted"} operating brief.`,
    "",
    ...(Object.keys(BRIEF_LABELS) as Array<
      keyof AiTeamFounderBriefSections
    >).flatMap((key) => [
      `## ${BRIEF_LABELS[key]}`,
      ...(brief.sections[key].length
        ? brief.sections[key].map((value) => `- ${value}`)
        : ["- No observed items."]),
      "",
    ]),
  ].join("\n");
}

export function FounderBriefCenter({
  brief,
  onRefresh,
  refreshing,
  error,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  async function copyBrief() {
    if (!brief) return;
    try {
      await navigator.clipboard.writeText(briefMarkdown(brief));
      setCopyError(null);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setCopyError("Clipboard access is unavailable.");
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              Founder Daily Brief
            </h3>
            <Badge variant="accent">Evidence-first</Badge>
            <Badge variant="success">Deterministic</Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            One operating brief per UTC date, generated from current evidence.
            No email or push is sent.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {brief ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void copyBrief()}
            >
              {copied ? "Copied" : "Copy as markdown"}
            </Button>
          ) : null}
          <Button
            size="sm"
            disabled={refreshing}
            onClick={() => void onRefresh()}
          >
            {refreshing
              ? "Generating…"
              : brief
                ? "Refresh brief"
                : "Generate brief"}
          </Button>
        </div>
      </header>

      {error || copyError ? (
        <p
          className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200"
          role="alert"
        >
          {copyError ?? error}
        </p>
      ) : null}

      {refreshing && !brief ? (
        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-5">
          <LoadingSkeleton lines={6} />
        </div>
      ) : !brief ? (
        <EmptyState
          icon="◆"
          title="No founder brief"
          description="Generate today’s deterministic UTC brief from the latest operating evidence."
        />
      ) : (
        <>
          <p className="text-xs text-[var(--text-muted)]">
            {brief.briefDate} UTC · Updated {formatDate(brief.updatedAt)} ·
            Source: {brief.source}
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {(
              Object.keys(BRIEF_LABELS) as Array<
                keyof AiTeamFounderBriefSections
              >
            ).map((key) => (
              <section
                key={key}
                className={`rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-5 ${
                  key === "topPriorities" ? "border-[var(--accent)]/30" : ""
                }`}
              >
                <h4 className="font-semibold text-[var(--foreground)]">
                  {BRIEF_LABELS[key]}
                </h4>
                {brief.sections[key].length ? (
                  <ul className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
                    {brief.sections[key].map((item) => (
                      <li key={item}>— {item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-[var(--text-muted)]">
                    No observed items.
                  </p>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
