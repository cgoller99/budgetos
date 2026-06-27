"use client";

import {
  FormField,
  Input,
  Select,
} from "@/components/ui";
import { BILL_CATEGORY_OPTIONS } from "@/lib/finance/billCategories";

export type BillFormState = {
  name: string;
  amount: string;
  dueDay: string;
  category: string;
  autopay: boolean;
  recurring: boolean;
};

type BillFormFieldsProps = {
  form: BillFormState;
  onChange: (form: BillFormState) => void;
};

export function BillFormFields({ form, onChange }: BillFormFieldsProps) {
  return (
    <>
      <FormField label="Bill Name">
        <Input
          type="text"
          value={form.name}
          onChange={(event) =>
            onChange({ ...form, name: event.target.value })
          }
          placeholder="Rent, Utilities..."
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

      <FormField label="Due Day">
        <Input
          type="number"
          min="0"
          max="31"
          value={form.dueDay}
          onChange={(event) =>
            onChange({ ...form, dueDay: event.target.value })
          }
          placeholder="1"
          required
        />
        <p className="mt-1.5 text-xs text-white/35">
          Use 0 for flexible or ongoing expenses.
        </p>
      </FormField>

      <FormField label="Category">
        <Select
          value={form.category}
          onChange={(event) =>
            onChange({ ...form, category: event.target.value })
          }
          required
        >
          <option value="">Select category</option>
          {BILL_CATEGORY_OPTIONS.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </Select>
      </FormField>

      <div className="space-y-2">
        <label className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 transition-colors duration-200 hover:bg-white/[0.05]">
          <input
            type="checkbox"
            checked={form.recurring}
            onChange={(event) =>
              onChange({ ...form, recurring: event.target.checked })
            }
            className="h-4 w-4 rounded border-white/20 bg-white/10 accent-[#0077ed]"
          />
          <span className="text-sm font-medium text-white/70">
            Recurring monthly bill
          </span>
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 transition-colors duration-200 hover:bg-white/[0.05]">
          <input
            type="checkbox"
            checked={form.autopay}
            onChange={(event) =>
              onChange({ ...form, autopay: event.target.checked })
            }
            className="h-4 w-4 rounded border-white/20 bg-white/10 accent-[#0077ed]"
          />
          <span className="text-sm font-medium text-white/70">Enable autopay</span>
        </label>
      </div>
    </>
  );
}

export const initialBillFormState: BillFormState = {
  name: "",
  amount: "",
  dueDay: "1",
  category: "",
  autopay: true,
  recurring: true,
};

export function billToFormState(bill: {
  name: string;
  amount: number;
  dueDay: number;
  autopay: boolean;
  recurring: boolean;
  category: string;
}): BillFormState {
  return {
    name: bill.name,
    amount: String(bill.amount),
    dueDay: String(bill.dueDay),
    category: bill.category,
    autopay: bill.autopay,
    recurring: bill.recurring,
  };
}

export function parseBillForm(form: BillFormState) {
  const amount = Number.parseFloat(form.amount);
  const dueDay = Number.parseInt(form.dueDay, 10);

  if (
    !form.name.trim() ||
    !form.category.trim() ||
    Number.isNaN(amount) ||
    Number.isNaN(dueDay)
  ) {
    return null;
  }

  return {
    name: form.name,
    amount,
    dueDay,
    autopay: form.autopay,
    recurring: form.recurring,
    category: form.category,
  };
}
