"use client";

import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { merchantGroupKey } from "@/lib/bills/merchantMatch";
import { formatCurrency } from "@/lib/finance/format";
import { dismissPlaidRecurringSuggestion } from "@/lib/plaid/clientApi";
import type { Bill } from "@/lib/finance/types";

type DeleteBillModalProps = {
  bill: Bill | null;
  onClose: () => void;
  /** Called after a successful delete (edit sheet should close). */
  onDeleted?: () => void;
  /** Called when user cancels — return to the editor when applicable. */
  onCancel?: () => void;
};

/**
 * Confirms bill removal. Deletes the bill record only — never bank transactions.
 * Also excludes the merchant from recurring detection so it does not reappear.
 */
export function DeleteBillModal({
  bill,
  onClose,
  onDeleted,
  onCancel,
}: DeleteBillModalProps) {
  const { deleteBill } = useFinance();
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<"delete" | "not_a_bill">("delete");

  function handleDismiss() {
    setMode("delete");
    (onCancel ?? onClose)();
  }

  async function excludeFromRecurringDetection(billName: string) {
    const merchantKey = merchantGroupKey(billName);
    if (!merchantKey || merchantKey.length < 3) {
      return;
    }

    try {
      await dismissPlaidRecurringSuggestion(merchantKey);
    } catch {
      // Non-fatal: bill is already removed from the active list.
    }
  }

  async function handleConfirm() {
    if (!bill) {
      return;
    }

    setIsSubmitting(true);

    try {
      await deleteBill(bill.id);
      await excludeFromRecurringDetection(bill.name);

      showToast({
        title:
          mode === "not_a_bill"
            ? `✓ ${bill.name} marked as not a bill`
            : `✓ ${bill.name} deleted`,
        subtitle: "Past payments and bank transactions were kept",
        type: "success",
      });

      setMode("delete");
      onDeleted?.();
      onClose();
    } catch {
      // FinanceContext toast
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={bill !== null}
      onClose={handleDismiss}
      title={mode === "not_a_bill" ? "Not a Bill" : "Delete Bill"}
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-white/70">
          {mode === "not_a_bill" ? (
            <>
              Remove{" "}
              <span className="font-semibold text-white">{bill?.name}</span> and
              stop treating it as a recurring bill? It will stay excluded even if
              similar charges appear again.
            </>
          ) : (
            <>
              Delete{" "}
              <span className="font-semibold text-white">{bill?.name}</span> (
              {formatCurrency(bill?.amount ?? 0)}) from your active bill list?
            </>
          )}
        </p>

        <ul className="space-y-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/60">
          <li>Future due dates and forecasts drop this bill.</li>
          <li>Historical payments stay in Buxme.</li>
          <li>Bank transactions are never deleted.</li>
        </ul>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setMode("delete")}
            className={`min-h-11 rounded-[12px] px-3 text-left text-[14px] font-medium ${
              mode === "delete"
                ? "border border-rose-400/40 bg-rose-500/15 text-rose-200"
                : "border border-white/[0.08] bg-white/[0.03] text-white/70"
            }`}
          >
            Delete Bill — remove from active Bills
          </button>
          <button
            type="button"
            onClick={() => setMode("not_a_bill")}
            className={`min-h-11 rounded-[12px] px-3 text-left text-[14px] font-medium ${
              mode === "not_a_bill"
                ? "border border-amber-400/40 bg-amber-500/15 text-amber-100"
                : "border border-white/[0.08] bg-white/[0.03] text-white/70"
            }`}
          >
            Not a Bill — remove and exclude from auto-detect
          </button>
        </div>

        <div
          className="sticky bottom-0 space-y-3 border-t border-white/[0.06] bg-[var(--surface)] pt-3 pb-[max(0.25rem,env(safe-area-inset-bottom))]"
          data-bill-delete-footer="true"
        >
          <div className="flex gap-3">
            <Button type="button" variant="secondary" fullWidth onClick={handleDismiss}>
              Cancel
            </Button>
            <Button
              type="button"
              fullWidth
              onClick={() => void handleConfirm()}
              disabled={isSubmitting}
              className="bg-rose-500 hover:bg-rose-600"
              data-bill-delete-confirm="true"
            >
              {isSubmitting
                ? "Working…"
                : mode === "not_a_bill"
                  ? "Remove from Bills"
                  : "Delete Bill"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
