"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  LoadingSkeleton,
} from "@/components/ui";
import type {
  AiTeamExecutionCandidate,
  AiTeamExecutionPacket,
} from "@/lib/ai-team/types";

type StagingDraft = {
  work: AiTeamExecutionCandidate;
  proposedBranchName: string;
  implementationBrief: string;
  validationChecklist: string;
  rollbackNotes: string;
};

type Props = {
  candidates: AiTeamExecutionCandidate[];
  packets: AiTeamExecutionPacket[];
  onStaged: (packet: AiTeamExecutionPacket) => void;
  onRefresh: () => void;
  loading: boolean;
  error: string | null;
};

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "approved-task"
  );
}

function snapshotLabel(
  value: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  return typeof value[key] === "string" ? value[key] : fallback;
}

function createDraft(work: AiTeamExecutionCandidate): StagingDraft {
  return {
    work,
    proposedBranchName: `ai-team/${slug(work.task.title)}-${work.task.id.slice(0, 8)}`,
    implementationBrief: [
      `Implement only the approved task "${work.task.title}".`,
      `Objective: ${work.task.objective}`,
      `Run goal: ${work.run.goal}`,
      "Preserve existing safety guardrails. Do not deploy or perform production operations.",
    ].join("\n\n"),
    validationChecklist: [
      "Run targeted automated tests for the changed scope.",
      "Run targeted lint and build validation.",
      "Confirm no deployment, customer outreach, data migration, or Stripe write occurred.",
    ].join("\n"),
    rollbackNotes:
      "Revert the implementation commit or discard the isolated branch changes. This packet does not include a production action.",
  };
}

function packetMarkdown(packet: AiTeamExecutionPacket): string {
  return [
    "# Execution-ready packet",
    "",
    "> No action executed by Mission Control. Requires external operator.",
    "",
    `- Task: ${snapshotLabel(packet.task, "title", packet.taskId)}`,
    `- Run: ${snapshotLabel(packet.run, "goal", packet.runId)}`,
    `- Status: ${packet.status}`,
    `- Proposed branch: \`${packet.proposedBranchName}\``,
    "",
    "## Implementation brief",
    packet.implementationBrief,
    "",
    "## Evidence",
    ...(packet.evidence.length
      ? packet.evidence.map((item) => `- ${item}`)
      : ["- No evidence recorded."]),
    "",
    "## Validation checklist",
    ...packet.validationChecklist.map((item) => `- [ ] ${item}`),
    "",
    "## Rollback notes",
    packet.rollbackNotes,
  ].join("\n");
}

export function ExecutionCenter({
  candidates,
  packets,
  onStaged,
  onRefresh,
  loading,
  error,
}: Props) {
  const [draft, setDraft] = useState<StagingDraft | null>(null);
  const [staging, setStaging] = useState(false);
  const [stageError, setStageError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const approved = candidates;

  const checklist =
    draft?.validationChecklist
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean) ?? [];
  const draftValid = Boolean(
    draft &&
      draft.proposedBranchName.trim().length >= 3 &&
      draft.implementationBrief.trim().length >= 10 &&
      checklist.length > 0 &&
      draft.rollbackNotes.trim().length >= 10,
  );

  async function stagePacket() {
    if (!draft || !draftValid || staging) return;
    setStaging(true);
    setStageError(null);
    try {
      const response = await fetch("/api/admin/ai-team/execution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: draft.work.task.id,
          proposedBranchName: draft.proposedBranchName.trim(),
          implementationBrief: draft.implementationBrief.trim(),
          validationChecklist: checklist,
          rollbackNotes: draft.rollbackNotes.trim(),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        packet?: AiTeamExecutionPacket;
        error?: string;
      };
      if (!response.ok || !payload.packet) {
        throw new Error(payload.error ?? "Unable to stage execution packet.");
      }
      onStaged(payload.packet);
      setDraft(null);
    } catch (requestError) {
      setStageError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to stage execution packet.",
      );
    } finally {
      setStaging(false);
    }
  }

  async function copyPacket(packet: AiTeamExecutionPacket) {
    try {
      await navigator.clipboard.writeText(packetMarkdown(packet));
      setCopiedId(packet.id);
      window.setTimeout(() => setCopiedId(null), 1_500);
    } catch {
      setStageError("Clipboard access is unavailable.");
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-[var(--foreground)]">
              Execution Center
            </h3>
            <Badge variant="warning">Staging only</Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Approved work becomes a reviewable handoff for an external operator.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </header>

      <div
        className="grid gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100 sm:grid-cols-2"
        role="note"
      >
        <p className="font-medium">No action executed by Mission Control</p>
        <p className="font-medium sm:text-right">Requires external operator</p>
      </div>

      {error ? (
        <p
          className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {stageError ? (
        <p
          className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200"
          role="alert"
        >
          {stageError}
        </p>
      ) : null}

      <section aria-labelledby="approved-work-heading">
        <h4
          id="approved-work-heading"
          className="font-semibold text-[var(--foreground)]"
        >
          Approved tasks ready to stage
        </h4>
        {approved.length ? (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {approved.map((work) => (
              <article
                key={work.task.id}
                className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-5"
              >
                <Badge variant="success">Approved</Badge>
                <h5 className="mt-3 font-semibold text-[var(--foreground)]">
                  {work.task.title}
                </h5>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {work.task.objective}
                </p>
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  Run: {work.run.goal}
                </p>
                <Button
                  className="mt-4"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setDraft(createDraft(work));
                    setStageError(null);
                  }}
                >
                  Prepare packet
                </Button>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            No approved, unstaged tasks are available.
          </p>
        )}
      </section>

      {draft ? (
        <section
          className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--surface-soft)] p-5"
          aria-labelledby="staging-form-heading"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4
                id="staging-form-heading"
                className="font-semibold text-[var(--foreground)]"
              >
                Stage: {draft.work.task.title}
              </h4>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Review and edit every field before creating the handoff.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDraft(null)}
              disabled={staging}
            >
              Cancel
            </Button>
          </div>
          <div className="mt-5 space-y-4">
            <label className="block text-xs font-medium text-[var(--text-muted)]">
              Branch suggestion
              <Input
                className="mt-2"
                value={draft.proposedBranchName}
                maxLength={120}
                onChange={(event) =>
                  setDraft((current) =>
                    current
                      ? { ...current, proposedBranchName: event.target.value }
                      : current,
                  )
                }
              />
            </label>
            {[
              {
                label: "Implementation brief",
                field: "implementationBrief" as const,
                value: draft.implementationBrief,
                maxLength: 5_000,
                rows: 6,
              },
              {
                label: "Validation checklist (one item per line)",
                field: "validationChecklist" as const,
                value: draft.validationChecklist,
                maxLength: 8_000,
                rows: 5,
              },
              {
                label: "Rollback notes",
                field: "rollbackNotes" as const,
                value: draft.rollbackNotes,
                maxLength: 3_000,
                rows: 4,
              },
            ].map((item) => (
              <label
                key={item.field}
                className="block text-xs font-medium text-[var(--text-muted)]"
              >
                {item.label}
                <textarea
                  className="focus-ring mt-2 w-full resize-y rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-3 text-sm text-[var(--foreground)] outline-none"
                  value={item.value}
                  rows={item.rows}
                  maxLength={item.maxLength}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, [item.field]: event.target.value }
                        : current,
                    )
                  }
                />
              </label>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[var(--text-muted)]">
              Creates a staged packet only. It does not claim or complete work.
            </p>
            <Button
              onClick={() => void stagePacket()}
              disabled={!draftValid || staging}
            >
              {staging ? "Staging…" : "Create execution-ready packet"}
            </Button>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="packets-heading">
        <h4
          id="packets-heading"
          className="font-semibold text-[var(--foreground)]"
        >
          Existing packets
        </h4>
        {loading && packets.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-5">
            <LoadingSkeleton lines={4} />
          </div>
        ) : packets.length === 0 ? (
          <EmptyState
            className="mt-3"
            icon="◇"
            title="No staged packets"
            description="Approve a gated task, then prepare its external-operator handoff here."
          />
        ) : (
          <div className="mt-3 space-y-3">
            {packets.map((packet) => (
              <article
                key={packet.id}
                className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="accent">Execution-ready</Badge>
                      <Badge variant="warning">Requires external operator</Badge>
                    </div>
                    <h5 className="mt-3 font-semibold text-[var(--foreground)]">
                      {snapshotLabel(packet.task, "title", "Approved task")}
                    </h5>
                    <p className="mt-1 break-all font-mono text-xs text-[var(--accent-light)]">
                      {packet.proposedBranchName}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void copyPacket(packet)}
                  >
                    {copiedId === packet.id ? "Copied" : "Copy as markdown"}
                  </Button>
                </div>
                <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[var(--text-secondary)]">
                  {packet.implementationBrief}
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      Validation
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
                      {packet.validationChecklist.map((item) => (
                        <li key={item}>□ {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      Rollback
                    </p>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                      {packet.rollbackNotes}
                    </p>
                  </div>
                </div>
                <p className="mt-4 border-t border-[var(--surface-border)] pt-3 text-xs text-amber-200/80">
                  No action executed by Mission Control.
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
