"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  DebtFormFields,
  debtToFormState,
  parseDebtForm,
} from "@/components/debt/DebtFormFields";
import { Button, Modal } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import type { Debt } from "@/lib/finance/types";

type EditDebtModalProps = {
  debt: Debt | null;
  onClose: () => void;
};

export function EditDebtModal({ debt, onClose }: EditDebtModalProps) {
  const { editDebt } = useFinance();
  const { showToast } = useToast();
  const [form, setForm] = useState(() =>
    debt
      ? debtToFormState(debt)
      : debtToFormState({
          name: "",
          balance: 0,
          interestRate: 0,
          minimumPayment: 0,
          dueDay: 15,
          accountType: "credit_card",
        }),
  );

  useEffect(() => {
    if (debt) {
      setForm(debtToFormState(debt));
    }
  }, [debt]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!debt) {
      return;
    }

    const parsed = parseDebtForm(form);

    if (!parsed) {
      return;
    }

    try {
      await editDebt(debt.id, parsed);

      showToast({
        title: `✓ ${parsed.name.trim()} Updated`,
        subtitle: "✓ Dashboard Updated",
      });

      onClose();
    } catch {
      // Error toast handled by FinanceContext
    }
  }

  return (
    <Modal isOpen={debt !== null} onClose={onClose} title="Edit Debt">
      <form onSubmit={handleSubmit} className="space-y-4">
        <DebtFormFields form={form} onChange={setForm} />

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
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
