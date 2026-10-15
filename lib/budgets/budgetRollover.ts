/**
 * Optional category budget rollover preferences.
 * Rollover only expands the category allowance for pacing/remaining display.
 * It never changes Safe to Spend, available cash, or bank balances.
 */

export const BUDGET_ROLLOVER_STORAGE_PREFIX = "buxme-budget-rollover";

export function budgetRolloverStorageKey(userId: string | null | undefined): string {
  return `${BUDGET_ROLLOVER_STORAGE_PREFIX}:${userId || "local"}`;
}

export function readBudgetRolloverCategories(
  storage: { getItem(key: string): string | null },
  userId: string | null | undefined,
): Set<string> {
  const raw = storage.getItem(budgetRolloverStorageKey(userId));
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter((item): item is string => typeof item === "string" && item.length > 0),
    );
  } catch {
    return new Set();
  }
}

export function writeBudgetRolloverCategories(
  storage: { setItem(key: string, value: string): void },
  userId: string | null | undefined,
  categories: Set<string>,
): void {
  storage.setItem(
    budgetRolloverStorageKey(userId),
    JSON.stringify([...categories].sort()),
  );
}

/**
 * Surplus from the previous comparable period that may roll into this period's
 * allowance. Never treated as cash.
 */
export function previousPeriodSurplus(limit: number, previousPeriodSpent: number): number {
  if (!Number.isFinite(limit) || limit < 0) return 0;
  if (!Number.isFinite(previousPeriodSpent) || previousPeriodSpent < 0) {
    return Math.round(limit * 100) / 100;
  }
  return Math.round(Math.max(0, limit - previousPeriodSpent) * 100) / 100;
}
