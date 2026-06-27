"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  BillFormFields,
  billToFormState,
  parseBillForm,
} from "@/components/bills/BillFormFields";
import { Button, Modal } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import type { Bill } from "@/lib/finance/types";

type EditBillModalProps = {
  bill: Bill | null;
  onClose: () => void;
};

export function EditBillModal({ bill, onClose }: EditBillModalProps) {
  const { editBill } = useFinance();
  const { showToast } = useToast();
  const [form, setForm] = useState(() =>
    bill ? billToFormState(bill) : billToFormState({
      name: "",
      amount: 0,
      dueDay: 1,
      autopay: true,
      recurring: true,
      category: "",
      paycheckAssignment: "first_paycheck",
      customPayDay: 15,
      paymentAccountId: null,
    }),
  );

  useEffect(() => {
    if (bill) {
      setForm(billToFormState(bill));
    }
  }, [bill]);

  function handleClose() {
    onClose();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!bill) {
      return;
    }

    const parsed = parseBillForm(form);

    if (!parsed) {
      return;
    }

    editBill(bill.id, parsed);

    showToast({
      title: `✓ ${parsed.name.trim()} Updated`,
      subtitle: "✓ Dashboard Updated",
    });

    handleClose();
  }

  return (
    <Modal
      isOpen={bill !== null}
      onClose={handleClose}
      title="Edit Bill"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <BillFormFields form={form} onChange={setForm} />

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" fullWidth onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" fullWidth>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}
