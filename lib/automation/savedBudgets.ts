export type SavedCategoryBudget = {
  category: string;
  amount: number;
};

const STORAGE_KEY = "buxme-category-budgets";

function storageKey(userId: string | null | undefined): string {
  return `${STORAGE_KEY}:${userId || "local"}`;
}

export function readSavedCategoryBudgets(
  userId: string | null | undefined,
): SavedCategoryBudget[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(storageKey(userId));
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored) as SavedCategoryBudget[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item) =>
        typeof item?.category === "string" &&
        item.category.trim().length > 0 &&
        typeof item.amount === "number" &&
        Number.isFinite(item.amount) &&
        item.amount >= 0,
    );
  } catch {
    return [];
  }
}

export function writeSavedCategoryBudgets(
  userId: string | null | undefined,
  budgets: SavedCategoryBudget[],
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey(userId), JSON.stringify(budgets));
}
