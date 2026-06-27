"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  IncomeFormFields,
  incomeToFormState,
  parseIncomeForm,
} from "@/components/income/IncomeFormFields";
import { Button, Modal } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import type { IncomeSource } from "@/lib/finance/types";

type EditIncomeModalProps = {
  income: IncomeSource | null;
  onClose: () => void;
};

export function EditIncomeModal({ income, onClose }: EditIncomeModalProps) {
  const { editIncome } = useFinance();
  const { showToast } = useToast();
  const [form, setForm] = useState(() =>
    income
      ? incomeToFormState(income)
      : incomeToFormState({
          name: "",
          amount: 0,
          frequency: "monthly",
          category: "",
          depositAccountId: null,
          schedule: {
            startDate: new Date().toISOString().split("T")[0] ?? "",
          },
        }),
  );

  useEffect(() => {
    if (income) {
      setForm(incomeToFormState(income));
    }
  }, [income]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!income) {
      return;
    }

    const parsed = parseIncomeForm(form);

    if (!parsed) {
      return;
    }

    try {
      await editIncome(income.id, parsed);

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
    <Modal isOpen={income !== null} onClose={onClose} title="Edit Income Source">
      <form onSubmit={handleSubmit} className="space-y-4">
        <IncomeFormFields form={form} onChange={setForm} />

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
