"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  IncomeFormFields,
  incomeToFormState,
  parseIncomeForm,
} from "@/components/income/IncomeFormFields";
import { Modal } from "@/components/ui";
import { NativeEditorActions } from "@/components/native/NativeEditorActions";
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
    <Modal isOpen={income !== null} onClose={onClose} title="Edit Income Source" footer={
        <NativeEditorActions
          formId="save-changes-form"
          onCancel={onClose}
          submitLabel="Save Changes"
        />
      }>
      <form id="save-changes-form" onSubmit={handleSubmit} className="space-y-4">

        <IncomeFormFields form={form} onChange={setForm} />
      </form>
    </Modal>
  );
}
