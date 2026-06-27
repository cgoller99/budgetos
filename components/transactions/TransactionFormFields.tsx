"use client";

import {
  FormField,
  Input,
  Select,
} from "@/components/ui";
import {
  TRANSACTION_CATEGORY_OPTIONS,
  TRANSACTION_TYPE_OPTIONS,
} from "@/lib/finance/transactionCategories";
import type { FinanceData, TransactionType } from "@/lib/finance/types";

export type TransactionFormState = {
  amount: string;
  type: TransactionType;
  category: string;
  accountId: string;
  transferAccountId: string;
  date: string;
  notes: string;
  goalId: string;
};

export function getDefaultTransactionFormState(
  accounts: FinanceData["accounts"],
): TransactionFormState {
  const today = new Date().toISOString().split("T")[0];

  return {
    amount: "",
    type: "expense",
    category: "",
    accountId: accounts[0]?.id ?? "",
    transferAccountId: accounts[1]?.id ?? accounts[0]?.id ?? "",
    date: today,
    notes: "",
    goalId: "",
  };
}

type TransactionFormFieldsProps = {
  form: TransactionFormState;
  accounts: FinanceData["accounts"];
  goals: FinanceData["savingsGoals"];
  onChange: (form: TransactionFormState) => void;
};

export function TransactionFormFields({
  form,
  accounts,
  goals,
  onChange,
}: TransactionFormFieldsProps) {
  const showTransferFields = form.type === "transfer";
  const showGoalField = form.type === "expense" && goals.length > 0;

  return (
    <>
      <FormField label="Type">
        <Select
          value={form.type}
          onChange={(event) =>
            onChange({
              ...form,
              type: event.target.value as TransactionType,
              category:
                event.target.value === "transfer" ? "Transfer" : form.category,
            })
          }
          required
        >
          {TRANSACTION_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
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

      <FormField label="Category">
        <Select
          value={form.category}
          onChange={(event) =>
            onChange({ ...form, category: event.target.value })
          }
          required
        >
          <option value="">Select category</option>
          {TRANSACTION_CATEGORY_OPTIONS.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label={showTransferFields ? "From Account" : "Account"}>
        <Select
          value={form.accountId}
          onChange={(event) =>
            onChange({ ...form, accountId: event.target.value })
          }
          required
        >
          <option value="">Select account</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </Select>
      </FormField>

      {showTransferFields && (
        <FormField label="To Account">
          <Select
            value={form.transferAccountId}
            onChange={(event) =>
              onChange({ ...form, transferAccountId: event.target.value })
            }
            required
          >
            <option value="">Select account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      {showGoalField && (
        <FormField label="Goal">
          <Select
            value={form.goalId}
            onChange={(event) =>
              onChange({ ...form, goalId: event.target.value })
            }
          >
            <option value="">General savings</option>
            {goals.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.name}
              </option>
            ))}
          </Select>
        </FormField>
      )}

      <FormField label="Date">
        <Input
          type="date"
          value={form.date}
          onChange={(event) => onChange({ ...form, date: event.target.value })}
          required
        />
      </FormField>

      <FormField label="Notes">
        <Input
          type="text"
          value={form.notes}
          onChange={(event) => onChange({ ...form, notes: event.target.value })}
          placeholder="Optional description"
        />
      </FormField>
    </>
  );
}

export function parseTransactionForm(
  form: TransactionFormState,
): import("@/lib/finance/types").AddTransactionInput | null {
  const amount = Number.parseFloat(form.amount);

  if (Number.isNaN(amount) || amount <= 0) {
    return null;
  }

  if (!form.accountId || !form.category || !form.date) {
    return null;
  }

  if (form.type === "transfer" && !form.transferAccountId) {
    return null;
  }

  return {
    amount,
    type: form.type,
    category: form.category,
    accountId: form.accountId,
    transferAccountId:
      form.type === "transfer" ? form.transferAccountId : null,
    date: form.date,
    notes: form.notes,
    goalId: form.goalId || null,
  };
}

export function transactionToFormState(
  transaction: import("@/lib/finance/types").Transaction,
): TransactionFormState {
  return {
    amount: String(transaction.amount),
    type: transaction.type,
    category: transaction.category,
    accountId: transaction.accountId,
    transferAccountId: transaction.transferAccountId ?? "",
    date: transaction.date,
    notes: transaction.notes,
    goalId: transaction.goalId ?? "",
  };
}
