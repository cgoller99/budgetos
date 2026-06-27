"use client";

import { Button, Modal } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/finance/format";
import type { IncomeSource } from "@/lib/finance/types";

type DeleteIncomeModalProps = {
  income: IncomeSource | null;
  onClose: () => void;
};

export function DeleteIncomeModal({ income, onClose }: DeleteIncomeModalProps) {
  const { deleteIncome } = useFinance();
  const { showToast } = useToast();

  async function handleDelete() {
    if (!income) {
      return;
    }

    try {
      await deleteIncome(income.id);

      showToast({
        title: `✓ ${income.name} Deleted`,
        subtitle: "✓ Dashboard Updated",
      });

      onClose();
    } catch {
      // Error toast handled by FinanceContext
    }
  }

  return (
    <Modal
      isOpen={income !== null}
      onClose={onClose}
      title="Delete Income Source"
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-white/60">
          Are you sure you want to delete{" "}
          <span className="font-medium text-white">{income?.name}</span>? This
          removes {formatCurrency(income?.amount ?? 0)} from your recurring
          income projections.
        </p>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            fullWidth
            onClick={() => void handleDelete()}
            className="bg-rose-500 hover:bg-rose-600"
          >
            Delete Income
          </Button>
        </div>
      </div>
    </Modal>
  );
}
