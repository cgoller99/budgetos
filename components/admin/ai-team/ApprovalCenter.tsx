"use client";

import { useMemo, useState } from "react";
import { Badge, Button, EmptyState, Modal } from "@/components/ui";
import type {
  AiTeamApprovalDecision,
  AiTeamRun,
  AiTeamTask,
} from "@/lib/ai-team/types";
import { AgentChip, DecisionBadge, formatDate } from "./shared";

type PendingDecision = {
  task: AiTeamTask;
  run: AiTeamRun;
  decision: "approved" | "rejected";
};

export function ApprovalCenter({
  runs,
  decisions,
  onDecision,
}: {
  runs: AiTeamRun[];
  decisions: AiTeamApprovalDecision[];
  onDecision: (
    taskId: string,
    decision: "approved" | "rejected",
    note: string,
  ) => Promise<void>;
}) {
  const [pending, setPending] = useState<PendingDecision | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const decisionsByTask = useMemo(
    () => new Map(decisions.map((decision) => [decision.taskId, decision])),
    [decisions],
  );
  const gated = runs.flatMap((run) =>
    run.tasks
      .filter((task) => task.requiresApproval)
      .map((task) => ({ task, run, decision: decisionsByTask.get(task.id) })),
  );
  const pendingItems = gated.filter((item) => !item.decision);

  async function confirm() {
    if (!pending) return;
    setSaving(true);
    try {
      await onDecision(pending.task.id, pending.decision, note);
      setPending(null);
      setNote("");
    } catch {
      // The parent surfaces the API error without discarding the confirmation.
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">Approval Center</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Record a decision only. Approval never executes the underlying action.
          </p>
        </div>
        <Badge variant={pendingItems.length > 0 ? "warning" : "success"}>
          {pendingItems.length} pending
        </Badge>
      </div>
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-100/80">
        Decisions are immutable audit records. Execution remains outside Mission Control.
      </div>

      {gated.length === 0 ? (
        <EmptyState icon="✓" title="No approval-gated work" description="Gated tasks from recent runs will appear here." />
      ) : (
        <div className="space-y-3">
          {gated.map(({ task, run, decision }) => (
            <article
              key={task.id}
              className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <AgentChip id={task.owner} />
                    <DecisionBadge decision={decision?.decision} />
                  </div>
                  <h4 className="mt-3 font-semibold text-[var(--foreground)]">{task.title}</h4>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">{task.objective}</p>
                  <p className="mt-2 text-xs text-[var(--text-muted)]">Run: {run.goal}</p>
                  <p className="mt-2 text-xs leading-relaxed text-amber-200/80">
                    {task.approvalReason ?? "Production-sensitive action requires approval."}
                  </p>
                </div>
                {!decision ? (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" onClick={() => setPending({ task, run, decision: "approved" })}>
                      Approve
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setPending({ task, run, decision: "rejected" })}>
                      Reject
                    </Button>
                  </div>
                ) : null}
              </div>
              {decision ? (
                <div className="mt-4 border-t border-[var(--surface-border)] pt-3 text-xs text-[var(--text-muted)]">
                  <p>
                    {formatDate(decision.createdAt)} · {decision.actorEmail ?? decision.actorId}
                  </p>
                  {decision.note ? <p className="mt-1 text-[var(--text-secondary)]">{decision.note}</p> : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <Modal
        isOpen={Boolean(pending)}
        onClose={() => {
          if (!saving) setPending(null);
        }}
        title={`${pending?.decision === "approved" ? "Approve" : "Reject"} this task?`}
      >
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          This records an immutable decision for “{pending?.task.title}”. It does
          not execute, deploy, write, contact, charge, or otherwise perform the task.
        </p>
        <label htmlFor="approval-note" className="mt-5 block text-xs font-medium text-[var(--text-muted)]">
          Note (optional)
        </label>
        <textarea
          id="approval-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={1000}
          rows={4}
          className="focus-ring mt-2 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-3 text-sm text-[var(--foreground)] outline-none"
        />
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setPending(null)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant={pending?.decision === "rejected" ? "danger" : "primary"}
            onClick={() => void confirm()}
            disabled={saving}
          >
            {saving ? "Recording…" : `Record ${pending?.decision}`}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
