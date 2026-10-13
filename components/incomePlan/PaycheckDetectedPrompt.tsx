"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { getDismissedAutomationIds } from "@/lib/automation/dismissals";
import {
  buildPaycheckReviews,
  paycheckReviewSuggestionId,
  type PaycheckReviewItem,
} from "@/lib/automation/paycheckReview";
import { formatCurrency } from "@/lib/finance/format";
import { formatPayDate } from "@/lib/incomePlan/payDates";

function confidenceLabel(item: PaycheckReviewItem): string {
  return item.confidence === "likely" ? "Likely" : "Needs confirmation";
}

export function PaycheckDetectedPrompt({ item }: { item: PaycheckReviewItem }) {
  const finance = useFinance();
  const { showToast } = useToast();
  const [isApplying, setIsApplying] = useState(false);
  const amountDiffers =
    item.planAmount !== null &&
    Math.abs(item.planAmount - item.actualAmount) > 1;

  async function handleApply() {
    setIsApplying(true);

    try {
      await finance.runIncomePlan({ sourceTransactionId: item.transactionId });
      showToast({
        title: "Income Plan applied",
        subtitle: "This deposit was used. A second paycheck was not added.",
        type: "success",
      });
    } catch {
      // Error toast handled by FinanceContext
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <Card padding="lg" className="border-[var(--accent)]/30 bg-[var(--accent)]/5">
      <CardHeader
        title="Received paycheck"
        description="A matching deposit is in. Allocations stay unapplied until you confirm."
        action={
          <Badge variant={item.confidence === "likely" ? "accent" : "warning"}>
            {confidenceLabel(item)}
          </Badge>
        }
      />
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-[var(--text-muted)]">Merchant</p>
            <p className="text-sm font-semibold text-[var(--foreground)]">{item.merchant}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Deposit</p>
            <p className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
              {formatCurrency(item.actualAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Frequency</p>
            <p className="text-sm text-[var(--foreground)]">{item.frequencyLabel}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Expected payday</p>
            <p className="text-sm text-[var(--foreground)]">
              {item.expectedPayDate ? formatPayDate(item.expectedPayDate) : "Not scheduled"}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Matched source</p>
            <p className="text-sm text-[var(--foreground)]">
              {item.matchedSourceName ?? "Income Plan amount"}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Expected amount</p>
            <p className="text-sm tabular-nums text-[var(--foreground)]">
              {formatCurrency(item.expectedAmount)}
            </p>
          </div>
        </div>

        {amountDiffers ? (
          <p className="text-sm text-[var(--text-muted)]">
            This deposit is {formatCurrency(item.actualAmount)}. Your plan is{" "}
            {formatCurrency(item.planAmount ?? 0)}. Prepared allocations follow the plan.
          </p>
        ) : null}

        {item.allocations.length > 0 ? (
          <ul className="space-y-2">
            {item.allocations.map((allocation) => (
              <li
                key={allocation.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
              >
                <span className="truncate text-sm text-[var(--foreground)]">
                  {allocation.name}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--foreground)]">
                  {formatCurrency(allocation.amount)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            {item.canApply
              ? "This plan has no allocations yet. Confirming still records the deposit as this paycheck."
              : "Set up an Income Plan before allocations can be prepared."}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {item.canApply ? (
            <Button onClick={() => void handleApply()} disabled={isApplying || finance.isSyncing}>
              {isApplying ? "Applying…" : "Apply allocations"}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            onClick={() =>
              finance.dismissAutomationSuggestion(
                paycheckReviewSuggestionId(item.transactionId),
              )
            }
          >
            Not this deposit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function PaycheckDetectedPromptList() {
  const finance = useFinance();
  const reviews = useMemo(() => {
    const dismissed = getDismissedAutomationIds();
    return buildPaycheckReviews(finance).filter(
      (item) => !dismissed.has(paycheckReviewSuggestionId(item.transactionId)),
    );
  }, [finance]);

  if (reviews.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {reviews.map((item) => (
        <PaycheckDetectedPrompt key={item.transactionId} item={item} />
      ))}
    </div>
  );
}
