"use client";

import { FormField, Input, Select } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { INCOME_FREQUENCY_OPTIONS } from "@/lib/recurring/frequencies";
import type { IncomeFrequency } from "@/lib/finance/types";

export type IncomeFormState = {
  name: string;
  amount: string;
  frequency: IncomeFrequency;
  category: string;
  startDate: string;
  depositAccountId: string;
};

type IncomeFormFieldsProps = {
  form: IncomeFormState;
  onChange: (form: IncomeFormState) => void;
};

export function incomeToFormState(source: {
  name: string;
  amount: number;
  frequency: IncomeFrequency;
  category: string;
  depositAccountId?: string | null;
  schedule?: { startDate: string };
}): IncomeFormState {
  return {
    name: source.name,
    amount: String(source.amount),
    frequency: source.frequency === "every_2_weeks" ? "biweekly" : source.frequency,
    category: source.category,
    startDate:
      source.schedule?.startDate ?? new Date().toISOString().split("T")[0] ?? "",
    depositAccountId: source.depositAccountId ?? "",
  };
}

export function parseIncomeForm(form: IncomeFormState) {
  const amount = Number.parseFloat(form.amount);

  if (
    !form.name.trim() ||
    !form.category.trim() ||
    !form.startDate.trim() ||
    Number.isNaN(amount)
  ) {
    return null;
  }

  return {
    name: form.name,
    amount,
    frequency: form.frequency,
    category: form.category,
    startDate: form.startDate,
    depositAccountId: form.depositAccountId || null,
  };
}

export function IncomeFormFields({ form, onChange }: IncomeFormFieldsProps) {
  const { accounts } = useFinance();

  return (
    <>
      <FormField label="Income Name">
        <Input
          type="text"
          value={form.name}
          onChange={(event) =>
            onChange({ ...form, name: event.target.value })
          }
          placeholder="Salary, Freelance..."
          required
        />
      </FormField>

      <FormField label="Amount">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={form.amount}
          onChange={(event) =>
            onChange({ ...form, amount: event.target.value })
          }
          placeholder="0.00"
          required
        />
      </FormField>

      <FormField label="Frequency">
        <Select
          value={form.frequency}
          onChange={(event) =>
            onChange({
              ...form,
              frequency: event.target.value as IncomeFrequency,
            })
          }
        >
          {INCOME_FREQUENCY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Start date">
        <Input
          type="date"
          value={form.startDate}
          onChange={(event) =>
            onChange({ ...form, startDate: event.target.value })
          }
          required
        />
      </FormField>

      <FormField label="Deposit account">
        <Select
          value={form.depositAccountId}
          onChange={(event) =>
            onChange({ ...form, depositAccountId: event.target.value })
          }
        >
          <option value="">Primary cash account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Category">
        <Input
          type="text"
          value={form.category}
          onChange={(event) =>
            onChange({ ...form, category: event.target.value })
          }
          placeholder="Employment, Side Income..."
          required
        />
      </FormField>
    </>
  );
}
