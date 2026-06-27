export const BILL_CATEGORY_OPTIONS = [
  "Housing",
  "Utilities",
  "Food",
  "Transport",
  "Insurance",
  "Healthcare",
  "Lifestyle",
  "Subscriptions",
  "Education",
  "Other",
] as const;

export type BillCategory = (typeof BILL_CATEGORY_OPTIONS)[number];

export function normalizeBillCategory(category: string): string {
  const trimmed = category.trim();
  const match = BILL_CATEGORY_OPTIONS.find(
    (option) => option.toLowerCase() === trimmed.toLowerCase(),
  );

  return match ?? trimmed;
}
