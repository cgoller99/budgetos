"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Modal } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { formatCurrency } from "@/lib/finance/format";
import { getBillFrequencyLabel } from "@/lib/recurring/frequencies";
import type { RecurringBillCandidate } from "@/lib/plaid/types";

type RecurringBillsFoundModalProps = {
  isOpen: boolean;
  candidates: RecurringBillCandidate[];
  isSubmitting?: boolean;
  onAddSelected: (selected: RecurringBillCandidate[]) => void | Promise<void>;
  onIgnore: (selected: RecurringBillCandidate[]) => void | Promise<void>;
  onRemindLater: () => void | Promise<void>;
  onClose: () => void;
};

function candidateKey(candidate: RecurringBillCandidate): string {
  return candidate.merchantKey;
}

function formatCandidateAmount(candidate: RecurringBillCandidate): string {
  if (candidate.action === "update") {
    return `~${formatCurrency(candidate.averageAmount)}`;
  }

  return formatCurrency(candidate.averageAmount);
}

export function RecurringBillsFoundModal({
  isOpen,
  candidates,
  isSubmitting = false,
  onAddSelected,
  onIgnore,
  onRemindLater,
  onClose,
}: RecurringBillsFoundModalProps) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    () => new Set(candidates.map(candidateKey)),
  );

  useEffect(() => {
    setSelectedKeys(new Set(candidates.map(candidateKey)));
  }, [candidates]);

  const selectedCandidates = useMemo(
    () => candidates.filter((candidate) => selectedKeys.has(candidateKey(candidate))),
    [candidates, selectedKeys],
  );

  function toggleCandidate(key: string) {
    setSelectedKeys((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }

  function selectAll() {
    setSelectedKeys(new Set(candidates.map(candidateKey)));
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`We found ${candidates.length} recurring bill${candidates.length === 1 ? "" : "s"}`}
    >
      <p className="text-sm leading-relaxed text-[var(--text-muted)]">
        Review detected recurring charges from your synced transactions. Buxme will never add bills
        without your approval.
      </p>

      <div className="mt-5 max-h-[min(50vh,420px)] space-y-2 overflow-y-auto pr-1">
        {candidates.map((candidate) => {
          const key = candidateKey(candidate);
          const checked = selectedKeys.has(key);

          return (
            <label
              key={key}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors",
                checked
                  ? "border-[var(--accent)]/30 bg-[var(--accent)]/10"
                  : "border-[var(--surface-border)] bg-[var(--surface-subtle)]",
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleCandidate(key)}
                className="mt-1 h-4 w-4 rounded border-[var(--surface-border)] accent-[var(--accent)]"
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-[var(--foreground)]">
                    {candidate.displayName}
                  </span>
                  <span className="text-sm tabular-nums text-[var(--text-secondary)]">
                    {formatCandidateAmount(candidate)} ·{" "}
                    {getBillFrequencyLabel(candidate.frequency)}
                  </span>
                </span>
                <span className="mt-1 block text-xs text-[var(--text-muted)]">
                  {candidate.action === "update"
                    ? "Matches an existing bill — we'll suggest updating it."
                    : "New recurring bill"}
                  {candidate.lastPaymentDate
                    ? ` · Last payment ${candidate.lastPaymentDate}`
                    : ""}
                  {candidate.nextEstimatedPaymentDate
                    ? ` · Next ~${candidate.nextEstimatedPaymentDate}`
                    : ""}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        <Button
          variant="ghost"
          size="md"
          disabled={isSubmitting}
          onClick={() => void onRemindLater()}
        >
          Remind Me Later
        </Button>
        <Button
          variant="secondary"
          size="md"
          disabled={isSubmitting || selectedCandidates.length === 0}
          onClick={() => void onIgnore(selectedCandidates)}
        >
          Ignore
        </Button>
        <Button variant="secondary" size="md" disabled={isSubmitting} onClick={selectAll}>
          Select All
        </Button>
        <Button
          size="md"
          disabled={isSubmitting || selectedCandidates.length === 0}
          onClick={() => void onAddSelected(selectedCandidates)}
        >
          {isSubmitting
            ? "Adding..."
            : `Add Selected (${selectedCandidates.length})`}
        </Button>
      </div>
    </Modal>
  );
}

export function RecurringBillsFoundCard({
  candidates,
  onReview,
}: {
  candidates: RecurringBillCandidate[];
  onReview: () => void;
}) {
  if (candidates.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--foreground)]">Recurring bills found</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            We detected {candidates.length} recurring charge
            {candidates.length === 1 ? "" : "s"} from your synced transactions.
          </p>
        </div>
        <Button size="md" onClick={onReview}>
          Review bills
        </Button>
      </div>
    </div>
  );
}
