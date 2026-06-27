"use client";

import { FormField, Input, Select } from "@/components/ui";
import { DEBT_ACCOUNT_TYPE_OPTIONS } from "@/lib/finance/debts";
import type { DebtAccountType } from "@/lib/finance/types";

export type DebtFormState = {
  name: string;
  balance: string;
  interestRate: string;
  minimumPayment: string;
  dueDay: string;
  accountType: DebtAccountType;
};

type DebtFormFieldsProps = {
  form: DebtFormState;
  onChange: (form: DebtFormState) => void;
};

export function debtToFormState(debt: {
  name: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
  dueDay: number;
  accountType: DebtAccountType;
}): DebtFormState {
  return {
    name: debt.name,
    balance: String(debt.balance),
    interestRate: String(debt.interestRate),
    minimumPayment: String(debt.minimumPayment),
    dueDay: String(debt.dueDay),
    accountType: debt.accountType,
  };
}

export function parseDebtForm(form: DebtFormState) {
  const balance = Number.parseFloat(form.balance);
  const interestRate = Number.parseFloat(form.interestRate);
  const minimumPayment = Number.parseFloat(form.minimumPayment);
  const dueDay = Number.parseInt(form.dueDay, 10);

  if (
    !form.name.trim() ||
    Number.isNaN(balance) ||
    Number.isNaN(interestRate) ||
    Number.isNaN(minimumPayment) ||
    Number.isNaN(dueDay)
  ) {
    return null;
  }

  return {
    name: form.name,
    balance,
    interestRate,
    minimumPayment,
    dueDay,
    accountType: form.accountType,
  };
}

export function DebtFormFields({ form, onChange }: DebtFormFieldsProps) {
  return (
    <>
      <FormField label="Debt Name">
        <Input
          type="text"
          value={form.name}
          onChange={(event) =>
            onChange({ ...form, name: event.target.value })
          }
          placeholder="Credit Card, Student Loan..."
          required
        />
      </FormField>

      <FormField label="Current Balance">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={form.balance}
          onChange={(event) =>
            onChange({ ...form, balance: event.target.value })
          }
          placeholder="0.00"
          required
        />
      </FormField>

      <FormField label="Interest Rate (APR %)">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={form.interestRate}
          onChange={(event) =>
            onChange({ ...form, interestRate: event.target.value })
          }
          placeholder="18.99"
          required
        />
      </FormField>

      <FormField label="Minimum Payment">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={form.minimumPayment}
          onChange={(event) =>
            onChange({ ...form, minimumPayment: event.target.value })
          }
          placeholder="0.00"
          required
        />
      </FormField>

      <FormField label="Due Day">
        <Input
          type="number"
          min="0"
          max="31"
          value={form.dueDay}
          onChange={(event) =>
            onChange({ ...form, dueDay: event.target.value })
          }
          placeholder="15"
          required
        />
        <p className="mt-1.5 text-xs text-white/35">
          Day of the month your payment is due. Use 0 if flexible.
        </p>
      </FormField>

      <FormField label="Account Type">
        <Select
          value={form.accountType}
          onChange={(event) =>
            onChange({
              ...form,
              accountType: event.target.value as DebtAccountType,
            })
          }
        >
          {DEBT_ACCOUNT_TYPE_OPTIONS.map((option) => (
            <option
              key={option.value}
              value={option.value}
              className="bg-[#111827] text-white"
            >
              {option.label}
            </option>
          ))}
        </Select>
      </FormField>
    </>
  );
}
