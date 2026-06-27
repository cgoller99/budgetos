export const TRANSACTION_CATEGORY_OPTIONS = [
  "Salary",
  "Freelance",
  "Investment",
  "Refund",
  "Housing",
  "Utilities",
  "Food",
  "Transport",
  "Insurance",
  "Healthcare",
  "Lifestyle",
  "Subscriptions",
  "Education",
  "Savings",
  "Transfer",
  "Other",
] as const;

export type TransactionCategory = (typeof TRANSACTION_CATEGORY_OPTIONS)[number];

export function normalizeTransactionCategory(category: string): string {
  const trimmed = category.trim();
  const match = TRANSACTION_CATEGORY_OPTIONS.find(
    (option) => option.toLowerCase() === trimmed.toLowerCase(),
  );

  return match ?? trimmed;
}

export const TRANSACTION_TYPE_OPTIONS = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "transfer", label: "Transfer" },
] as const;
