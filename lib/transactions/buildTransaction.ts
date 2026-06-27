import { normalizeTransactionCategory } from "@/lib/finance/transactionCategories";
import type {
  AddTransactionInput,
  EditTransactionInput,
  Transaction,
} from "@/lib/finance/types";

export function buildTransactionFromInput(
  input: AddTransactionInput,
  id = crypto.randomUUID(),
): Transaction {
  const goalId =
    input.type === "expense" && input.goalId ? input.goalId : null;

  return {
    id,
    amount: input.amount,
    type: input.type,
    category: normalizeTransactionCategory(input.category),
    accountId: input.accountId,
    transferAccountId:
      input.type === "transfer" ? (input.transferAccountId ?? null) : null,
    date: input.date,
    notes: input.notes?.trim() ?? "",
    goalId,
  };
}

export function buildUpdatedTransaction(
  existing: Transaction,
  input: EditTransactionInput,
): Transaction {
  return buildTransactionFromInput(input, existing.id);
}

export function validateTransactionInput(
  input: AddTransactionInput,
): string | null {
  if (input.amount <= 0) {
    return "Amount must be greater than zero.";
  }

  if (!input.accountId) {
    return "Select an account.";
  }

  if (input.type === "transfer") {
    if (!input.transferAccountId) {
      return "Select a destination account for transfers.";
    }

    if (input.transferAccountId === input.accountId) {
      return "Transfer accounts must be different.";
    }
  }

  if (!input.category.trim()) {
    return "Select a category.";
  }

  if (!input.date) {
    return "Select a date.";
  }

  return null;
}
