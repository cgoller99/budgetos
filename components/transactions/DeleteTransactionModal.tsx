"use client";

import { Button, Modal } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/finance/format";
import type { Transaction } from "@/lib/finance/types";
import { formatTransactionDate, getTransactionTypeLabel } from "@/lib/transactions";

type DeleteTransactionModalProps = {
  transaction: Transaction | null;
  onClose: () => void;
};

export function DeleteTransactionModal({
  transaction,
  onClose,
}: DeleteTransactionModalProps) {
  const { deleteTransaction } = useFinance();
  const { showToast } = useToast();

  async function handleDelete() {
    if (!transaction) {
      return;
    }

    try {
      await deleteTransaction(transaction.id);
      showToast({
        title: "✓ Transaction Deleted",
        subtitle: "✓ Dashboard Updated",
      });
      onClose();
    } catch {
      // Error toast handled by FinanceContext
    }
  }

  return (
    <Modal
      isOpen={Boolean(transaction)}
      onClose={onClose}
      title="Delete Transaction"
    >
      {transaction && (
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-white/60">
            Delete this {getTransactionTypeLabel(transaction.type).toLowerCase()}{" "}
            from {formatTransactionDate(transaction.date)}? Account balances and
            your dashboard will be updated automatically.
          </p>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3.5">
            <p className="text-sm font-medium text-white">
              {transaction.notes || transaction.category}
            </p>
            <p className="mt-1 text-xs text-white/45">
              {formatCurrency(transaction.amount)} · {transaction.category}
            </p>
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="secondary" fullWidth onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" fullWidth onClick={() => void handleDelete()}>
              Delete
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
