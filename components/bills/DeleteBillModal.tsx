"use client";

import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/finance/format";
import type { Bill } from "@/lib/finance/types";

type DeleteBillModalProps = {
  bill: Bill | null;
  onClose: () => void;
};

export function DeleteBillModal({ bill, onClose }: DeleteBillModalProps) {
  const { deleteBill } = useFinance();
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleDelete() {
    if (!bill) {
      return;
    }

    setIsSubmitting(true);

    try {
      await deleteBill(bill.id);

      showToast({
        title: `✓ ${bill.name} removed`,
        subtitle: "Past payments and transactions were kept",
        type: "success",
      });

      onClose();
    } catch {
      // FinanceContext toast
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen={bill !== null} onClose={onClose} title="Remove Bill">
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-white/70">
          Remove{" "}
          <span className="font-semibold text-white">{bill?.name}</span> (
          {formatCurrency(bill?.amount ?? 0)}) from your active bill list?
        </p>
        <ul className="space-y-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/60">
          <li>It will no longer appear in Upcoming, All, or Recurring.</li>
          <li>Historical payments and linked transactions stay in your history.</li>
          <li>You can add the bill again later if you need it.</li>
        </ul>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            fullWidth
            onClick={() => void handleDelete()}
            disabled={isSubmitting}
            className="bg-rose-500 hover:bg-rose-600"
          >
            {isSubmitting ? "Removing…" : "Remove Bill"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
