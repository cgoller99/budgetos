"use client";

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

  function handleDelete() {
    if (!bill) {
      return;
    }

    deleteBill(bill.id);

    showToast({
      title: `✓ ${bill.name} Deleted`,
      subtitle: "✓ Dashboard Updated",
    });

    onClose();
  }

  return (
    <Modal
      isOpen={bill !== null}
      onClose={onClose}
      title="Delete Bill"
    >
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-white/60">
          Are you sure you want to delete{" "}
          <span className="font-medium text-white">{bill?.name}</span>? This
          removes {formatCurrency(bill?.amount ?? 0)} from your monthly bills.
        </p>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            fullWidth
            onClick={handleDelete}
            className="bg-rose-500 hover:bg-rose-600"
          >
            Delete Bill
          </Button>
        </div>
      </div>
    </Modal>
  );
}
