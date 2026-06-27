"use client";

import { Button, Modal } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/finance/format";
import type { Debt } from "@/lib/finance/types";

type DeleteDebtModalProps = {
  debt: Debt | null;
  onClose: () => void;
};

export function DeleteDebtModal({ debt, onClose }: DeleteDebtModalProps) {
  const { deleteDebt } = useFinance();
  const { showToast } = useToast();

  async function handleDelete() {
    if (!debt) {
      return;
    }

    try {
      await deleteDebt(debt.id);

      showToast({
        title: `✓ ${debt.name} Deleted`,
        subtitle: "✓ Dashboard Updated",
      });

      onClose();
    } catch {
      // Error toast handled by FinanceContext
    }
  }

  return (
    <Modal isOpen={debt !== null} onClose={onClose} title="Delete Debt">
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-white/60">
          Are you sure you want to delete{" "}
          <span className="font-medium text-white">{debt?.name}</span>? This
          removes {formatCurrency(debt?.balance ?? 0)} from your debt planner
          and dashboard projections.
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
            Delete Debt
          </Button>
        </div>
      </div>
    </Modal>
  );
}
