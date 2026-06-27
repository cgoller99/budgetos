"use client";

import { useState, type FormEvent } from "react";
import {
  DebtFormFields,
  parseDebtForm,
  type DebtFormState,
} from "@/components/debt/DebtFormFields";
import { Button, Modal } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";

type AddDebtModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const initialFormState: DebtFormState = {
  name: "",
  balance: "",
  interestRate: "",
  minimumPayment: "",
  dueDay: "15",
  accountType: "credit_card",
};

export function AddDebtModal({ isOpen, onClose }: AddDebtModalProps) {
  const { addDebt } = useFinance();
  const { showToast } = useToast();
  const [form, setForm] = useState<DebtFormState>(initialFormState);

  function handleClose() {
    setForm(initialFormState);
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = parseDebtForm(form);

    if (!parsed) {
      return;
    }

    try {
      await addDebt(parsed);

      showToast({
        title: `✓ ${parsed.name.trim()} Added`,
        subtitle: "✓ Dashboard Updated",
      });

      handleClose();
    } catch {
      // Error toast handled by FinanceContext
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Debt">
      <form onSubmit={handleSubmit} className="space-y-4">
        <DebtFormFields form={form} onChange={setForm} />

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" fullWidth onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" fullWidth>
            Save Debt
          </Button>
        </div>
      </form>
    </Modal>
  );
}
