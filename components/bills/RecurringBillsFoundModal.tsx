"use client";

import { useMemo, useState } from "react";
import { AddBillModal } from "@/components/bills/AddBillModal";
import type { BillFormState } from "@/components/bills/BillFormFields";
import { Button, Modal } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { findSubscriptionPriceIncreases } from "@/lib/automation/financialInsights";
import { buildRecurringReview } from "@/lib/automation/recurringReview";
import { formatCurrency } from "@/lib/finance/format";
import type { RecurringBillCandidate } from "@/lib/plaid/types";
import { getBillFrequencyLabel } from "@/lib/recurring/frequencies";

type RecurringBillsFoundModalProps = {
  isOpen: boolean;
  candidates: RecurringBillCandidate[];
  isSubmitting?: boolean;
  onAddSelected: (selected: RecurringBillCandidate[]) => void | Promise<void>;
  onIgnore: (selected: RecurringBillCandidate[]) => void | Promise<void>;
  onDismiss: (candidate: RecurringBillCandidate) => void;
  onRemindLater: () => void | Promise<void>;
  onClose: () => void;
};

function formatNextCharge(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function draftFromCandidate(candidate: RecurringBillCandidate): BillFormState {
  return {
    name: candidate.displayName,
    category: candidate.category,
    frequency: candidate.frequency,
    startDate:
      candidate.nextEstimatedPaymentDate ??
      candidate.lastPaymentDate ??
      new Date().toISOString().slice(0, 10),
    autopay: false,
    recurring: true,
    splits: [
      {
        amount: String(candidate.averageAmount),
        dueDay: String(candidate.dueDay),
        paycheckAssignment: "first_paycheck",
        customPayDay: "15",
        paymentAccountId: candidate.paymentAccountId ?? "",
      },
    ],
  };
}

export function RecurringBillsFoundModal({
  isOpen,
  candidates,
  isSubmitting = false,
  onAddSelected,
  onIgnore,
  onDismiss,
  onRemindLater,
  onClose,
}: RecurringBillsFoundModalProps) {
  const finance = useFinance();
  const [draft, setDraft] = useState<BillFormState | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const items = useMemo(
    () =>
      buildRecurringReview(candidates, {
        transactions: finance.transactions,
      }),
    [candidates, finance.transactions],
  );
  const priceAlerts = useMemo(
    () => findSubscriptionPriceIncreases(finance),
    [finance],
  );

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Review recurring payments">
        <p className="text-sm leading-relaxed text-[var(--text-muted)]">
          These suggestions come from your transactions. Buxme will not add a bill until you
          confirm it.
        </p>

        {items.length === 0 && priceAlerts.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--text-muted)]">
            Nothing new to review.
          </p>
        ) : null}

        <div className="mt-4 max-h-[min(58vh,520px)] space-y-3 overflow-y-auto pr-1">
          {items.map((item) => {
            const nextCharge = formatNextCharge(item.nextCharge);

            return (
              <article
                key={item.merchantKey}
                className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[16px] font-semibold text-[var(--foreground)]">
                    {item.merchant}
                  </p>
                  <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[11px] font-semibold text-[var(--accent-light)]">
                    {item.kindLabel}
                  </span>
                </div>
                <p className="mt-1 text-[14px] text-[var(--text-secondary)]">
                  {formatCurrency(item.typicalAmount)} · {getBillFrequencyLabel(item.frequency)}
                  {nextCharge ? ` · Next ${nextCharge}` : ""}
                </p>
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                  {formatCurrency(item.monthlyEquivalent)} per month ·{" "}
                  {formatCurrency(item.annualEquivalent)} per year
                </p>
                <p className="mt-1 text-[12px] text-[var(--text-muted)]">
                  {item.confidenceLabel} · Not added yet
                </p>
                {item.priceChange ? (
                  <p className="mt-2 text-[13px] text-[var(--danger)]">
                    Latest charge {formatCurrency(item.priceChange.latestAmount)} is above the
                    earlier average of {formatCurrency(item.priceChange.previousAverage)}.
                  </p>
                ) : null}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    size="md"
                    disabled={isSubmitting}
                    onClick={() => void onAddSelected([item.candidate])}
                  >
                    Confirm
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={isSubmitting}
                    onClick={() => {
                      setDraft(draftFromCandidate(item.candidate));
                      setEditOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    size="md"
                    disabled={isSubmitting}
                    onClick={() => onDismiss(item.candidate)}
                  >
                    Dismiss
                  </Button>
                  <Button
                    variant="ghost"
                    size="md"
                    disabled={isSubmitting}
                    onClick={() => void onIgnore([item.candidate])}
                  >
                    Not recurring
                  </Button>
                </div>
              </article>
            );
          })}

          {priceAlerts.length > 0 ? (
            <div className="rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-4 py-3">
              <p className="text-[14px] font-semibold text-[var(--foreground)]">
                Price changes
              </p>
              <ul className="mt-2 space-y-2">
                {priceAlerts.map((alert) => (
                  <li key={alert.billId} className="text-[13px] text-[var(--text-secondary)]">
                    {alert.name} latest charge is {formatCurrency(alert.latestAmount)}, above the
                    earlier average of {formatCurrency(alert.previousAverage)}. The bill stays the
                    same until you edit it.
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="mt-4">
          <Button
            variant="ghost"
            size="md"
            fullWidth
            disabled={isSubmitting}
            onClick={() => void onRemindLater()}
          >
            Remind me later
          </Button>
        </div>
      </Modal>
      <AddBillModal
        isOpen={editOpen}
        draft={draft}
        onClose={() => {
          setEditOpen(false);
        }}
      />
    </>
  );
}

export function RecurringBillsFoundCard({
  candidates,
  priceAlertCount = 0,
  onReview,
}: {
  candidates: RecurringBillCandidate[];
  priceAlertCount?: number;
  onReview: () => void;
}) {
  const count = candidates.length + priceAlertCount;
  if (count === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--foreground)]">Recurring payments to review</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {count} suggestion{count === 1 ? "" : "s"} from your transactions. Nothing is added
            until you confirm.
          </p>
        </div>
        <Button size="md" onClick={onReview}>
          Review
        </Button>
      </div>
    </div>
  );
}
