"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  BillFormFields,
  billToFormState,
  initialBillFormState,
  parseBillForm,
} from "@/components/bills/BillFormFields";
import { Button, Modal } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import type { Bill } from "@/lib/finance/types";

type EditBillModalProps = {
  bill: Bill | null;
  onClose: () => void;
  /** Opens the remove confirmation flow without dismissing the edit sheet until called. */
  onRemove?: () => void;
};

export function EditBillModal({ bill, onClose, onRemove }: EditBillModalProps) {
  const { editBill } = useFinance();
  const { showToast } = useToast();
  const [form, setForm] = useState(() =>
    bill ? billToFormState(bill) : initialBillFormState,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (bill) {
      setForm(billToFormState(bill));
    }
  }, [bill]);

  function handleClose() {
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!bill) {
      return;
    }

    const parsed = parseBillForm(form);

    if (!parsed) {
      showToast({
        title: "Check bill details",
        subtitle: "Name, category, amount, and due day are required.",
        type: "error",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await editBill(bill.id, parsed);

      showToast({
        title: `✓ ${parsed.name.trim()} Updated`,
        subtitle: "✓ Dashboard Updated",
        type: "success",
      });

      handleClose();
    } catch {
      // FinanceContext toast
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={bill !== null}
      onClose={handleClose}
      title="Edit Bill"
    >
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
        <BillFormFields form={form} onChange={setForm} />

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" fullWidth onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" fullWidth disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
        </div>

        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            fullWidth
            className="text-rose-400 hover:text-rose-300"
            onClick={onRemove}
            disabled={isSubmitting}
          >
            Remove bill
          </Button>
        ) : null}
      </form>
    </Modal>
  );
}
