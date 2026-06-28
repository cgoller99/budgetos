"use client";

import {
  Button,
  FormField,
  Input,
  Select,
} from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { BILL_CATEGORY_OPTIONS } from "@/lib/finance/billCategories";
import { billAmountFromSplits } from "@/lib/finance/billSplits";
import { PAYCHECK_ASSIGNMENT_OPTIONS } from "@/lib/finance/paycheckSplit";
import { formatCurrency } from "@/lib/finance/format";
import { BILL_FREQUENCY_OPTIONS } from "@/lib/recurring/frequencies";
import type {
  Bill,
  BillFrequency,
  BillSplit,
  BillSplitInput,
  PaycheckAssignment,
} from "@/lib/finance/types";

export type BillSplitFormState = {
  id?: string;
  amount: string;
  dueDay: string;
  paycheckAssignment: PaycheckAssignment;
  customPayDay: string;
  paymentAccountId: string;
};

export type BillFormState = {
  name: string;
  category: string;
  frequency: BillFrequency;
  startDate: string;
  autopay: boolean;
  recurring: boolean;
  splits: BillSplitFormState[];
};

type BillFormFieldsProps = {
  form: BillFormState;
  onChange: (form: BillFormState) => void;
};

function createEmptySplit(): BillSplitFormState {
  return {
    amount: "",
    dueDay: "1",
    paycheckAssignment: "first_paycheck",
    customPayDay: "15",
    paymentAccountId: "",
  };
}

export function BillFormFields({ form, onChange }: BillFormFieldsProps) {
  const { accounts } = useFinance();
  const splitTotal = form.splits.reduce(
    (total, split) => total + (Number.parseFloat(split.amount) || 0),
    0,
  );

  function updateSplit(index: number, split: BillSplitFormState) {
    onChange({
      ...form,
      splits: form.splits.map((item, itemIndex) =>
        itemIndex === index ? split : item,
      ),
    });
  }

  function addSplit() {
    onChange({
      ...form,
      splits: [...form.splits, createEmptySplit()],
    });
  }

  function removeSplit(index: number) {
    if (form.splits.length <= 1) {
      return;
    }

    onChange({
      ...form,
      splits: form.splits.filter((_, itemIndex) => itemIndex !== index),
    });
  }

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

      <FormField label="Frequency">
        <Select
          value={form.frequency}
          onChange={(event) =>
            onChange({
              ...form,
              frequency: event.target.value as BillFrequency,
            })
          }
        >
          {BILL_FREQUENCY_OPTIONS.map((option) => (
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

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-white/70">Payment splits</p>
            <p className="mt-1 text-xs text-white/35">
              Split one bill across multiple due dates and paychecks.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={addSplit}>
            Add split
          </Button>
        </div>

        {form.splits.map((split, index) => (
          <div
            key={split.id ?? `split-${index}`}
            className="space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-white/70">
                Split {index + 1}
              </p>
              {form.splits.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-rose-400/90 hover:text-rose-300"
                  onClick={() => removeSplit(index)}
                >
                  Remove
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Amount">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={split.amount}
                  onChange={(event) =>
                    updateSplit(index, { ...split, amount: event.target.value })
                  }
                  placeholder="0.00"
                  required
                />
              </FormField>

              <FormField label="Due day">
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={split.dueDay}
                  onChange={(event) =>
                    updateSplit(index, { ...split, dueDay: event.target.value })
                  }
                  placeholder="1"
                  required
                />
              </FormField>
            </div>

            <FormField label="Paycheck assignment">
              <Select
                value={split.paycheckAssignment}
                onChange={(event) =>
                  updateSplit(index, {
                    ...split,
                    paycheckAssignment: event.target.value as PaycheckAssignment,
                  })
                }
              >
                {PAYCHECK_ASSIGNMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FormField>

            {split.paycheckAssignment === "custom" && (
              <FormField label="Custom pay day">
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={split.customPayDay}
                  onChange={(event) =>
                    updateSplit(index, {
                      ...split,
                      customPayDay: event.target.value,
                    })
                  }
                  placeholder="15"
                />
              </FormField>
            )}

            <FormField label="Payment account">
              <Select
                value={split.paymentAccountId}
                onChange={(event) =>
                  updateSplit(index, {
                    ...split,
                    paymentAccountId: event.target.value,
                  })
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
          </div>
        ))}

        <p className="text-sm text-white/45">
          Total bill amount:{" "}
          <span className="font-medium tabular-nums text-white/75">
            {formatCurrency(splitTotal)}
          </span>
        </p>
      </div>

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
            Active recurring bill
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
  category: "",
  frequency: "monthly",
  startDate: new Date().toISOString().split("T")[0] ?? "",
  autopay: true,
  recurring: true,
  splits: [createEmptySplit()],
};

function splitToFormState(split: BillSplit): BillSplitFormState {
  return {
    id: split.id,
    amount: String(split.amount),
    dueDay: String(split.dueDay),
    paycheckAssignment: split.paycheckAssignment,
    customPayDay: String(split.customPayDay ?? 15),
    paymentAccountId: split.paymentAccountId ?? "",
  };
}

export function billToFormState(bill: Bill): BillFormState {
  const splits =
    (bill.splits?.length ?? 0) > 0
      ? (bill.splits ?? []).map(splitToFormState)
      : [
          {
            amount: String(bill.amount),
            dueDay: String(bill.dueDay),
            paycheckAssignment: bill.paycheckAssignment ?? "first_paycheck",
            customPayDay: String(bill.customPayDay ?? 15),
            paymentAccountId: bill.paymentAccountId ?? "",
          },
        ];

  return {
    name: bill.name,
    category: bill.category,
    frequency: bill.frequency ?? "monthly",
    startDate:
      bill.schedule?.startDate ?? new Date().toISOString().split("T")[0] ?? "",
    autopay: bill.autopay,
    recurring: bill.schedule?.status !== "paused" && bill.recurring,
    splits,
  };
}

function parseSplitForm(split: BillSplitFormState): BillSplitInput | null {
  const amount = Number.parseFloat(split.amount);
  const dueDay = Number.parseInt(split.dueDay, 10);
  const customPayDay =
    split.paycheckAssignment === "custom"
      ? Number.parseInt(split.customPayDay, 10)
      : null;

  if (
    Number.isNaN(amount) ||
    Number.isNaN(dueDay) ||
    (split.paycheckAssignment === "custom" &&
      (customPayDay === null || Number.isNaN(customPayDay)))
  ) {
    return null;
  }

  return {
    id: split.id,
    amount,
    dueDay,
    paycheckAssignment: split.paycheckAssignment,
    customPayDay,
    paymentAccountId: split.paymentAccountId || null,
  };
}

export function parseBillForm(form: BillFormState) {
  if (!form.name.trim() || !form.category.trim() || !form.startDate.trim()) {
    return null;
  }

  const splits = form.splits
    .map(parseSplitForm)
    .filter((split): split is BillSplitInput => split !== null);

  if (splits.length !== form.splits.length) {
    return null;
  }

  const amount = billAmountFromSplits(splits);
  const primarySplit = splits[0];

  if (!primarySplit || amount <= 0) {
    return null;
  }

  return {
    name: form.name,
    amount,
    dueDay: primarySplit.dueDay,
    autopay: form.autopay,
    recurring: form.recurring,
    category: form.category,
    frequency: form.frequency,
    startDate: form.startDate,
    paycheckAssignment: primarySplit.paycheckAssignment,
    customPayDay: primarySplit.customPayDay,
    paymentAccountId: primarySplit.paymentAccountId,
    splits,
  };
}
