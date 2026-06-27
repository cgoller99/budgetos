"use client";

import { useState, type FormEvent } from "react";
import {
  IncomeFormFields,
  parseIncomeForm,
  type IncomeFormState,
} from "@/components/income/IncomeFormFields";
import { Button, Modal } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";

type AddIncomeModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const initialFormState: IncomeFormState = {
  name: "",
  amount: "",
  frequency: "monthly",
  category: "",
  startDate: new Date().toISOString().split("T")[0] ?? "",
  depositAccountId: "",
};

export function AddIncomeModal({ isOpen, onClose }: AddIncomeModalProps) {
  const { addIncome } = useFinance();
  const { showToast } = useToast();
  const [form, setForm] = useState<IncomeFormState>(initialFormState);

  function handleClose() {
    setForm(initialFormState);
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = parseIncomeForm(form);

    if (!parsed) {
      return;
    }

    try {
      await addIncome(parsed);

      showToast({
        title: `✓ ${parsed.name.trim()} Income Added`,
        subtitle: "✓ Dashboard Updated",
      });

      handleClose();
    } catch {
      // Error toast handled by FinanceContext
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Income">
      <form onSubmit={handleSubmit} className="space-y-4">
        <IncomeFormFields form={form} onChange={setForm} />

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" fullWidth onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" fullWidth>
            Save Income
          </Button>
        </div>
      </form>
    </Modal>
  );
}
