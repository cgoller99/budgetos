import {
  parseCategoryBudgetCache,
  visibleCategoryBudgets,
  type SavedCategoryBudget,
} from "@/lib/budgets/categoryBudgetSync";

export type { SavedCategoryBudget } from "@/lib/budgets/categoryBudgetSync";

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

  return visibleCategoryBudgets(
    parseCategoryBudgetCache(window.localStorage.getItem(storageKey(userId))),
  );
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
