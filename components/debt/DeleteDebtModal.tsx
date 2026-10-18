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
    <Modal
      isOpen={debt !== null}
      onClose={onClose}
      title="Delete Debt"
      footer={
        <div className="flex gap-3">
          <Button type="button" variant="secondary" fullWidth className="min-h-12" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            fullWidth
            className="min-h-12 bg-rose-500 hover:bg-rose-600"
            onClick={() => void handleDelete()}
          >
            Delete Debt
          </Button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-white/60">
        Are you sure you want to delete{" "}
        <span className="font-medium text-white">{debt?.name}</span>? This
        removes {formatCurrency(debt?.balance ?? 0)} from your debt planner
        and dashboard projections.
      </p>
    </Modal>
  );
}
