"use client";

import { useState, type FormEvent } from "react";
import { BillFormFields, initialBillFormState, parseBillForm } from "@/components/bills/BillFormFields";
import { Button, Modal } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";

type AddBillModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function AddBillModal({ isOpen, onClose }: AddBillModalProps) {
  const { addBill } = useFinance();
  const { showToast } = useToast();
  const [form, setForm] = useState(initialBillFormState);

  function handleClose() {
    setForm(initialBillFormState);
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = parseBillForm(form);

    if (!parsed) {
      return;
    }

    addBill(parsed);

    showToast({
      title: `✓ ${parsed.name.trim()} Bill Added`,
      subtitle: "✓ Dashboard Updated",
    });

    handleClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Bill">
      <form onSubmit={handleSubmit} className="space-y-4">
        <BillFormFields form={form} onChange={setForm} />

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" fullWidth onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" fullWidth>
            Save Bill
          </Button>
        </div>
      </form>
    </Modal>
  );
}
