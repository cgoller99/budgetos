import { calculateMoneyFlow } from "@/lib/finance/moneyFlow";
import type { FinanceData } from "@/lib/finance/types";
import { normalizeRecurringFinanceData } from "@/lib/recurring";

/** Weeks per month used consistently for weekly Safe To Spend display. */
export const WEEKS_PER_MONTH = 4.33;

/**
 * Canonical Safe To Spend — monthly remainder after income, bills, debts, goals,
 * and investments. Every surface must use this function.
 */
export function getSafeToSpend(data: FinanceData, referenceDate = new Date()): number {
  const normalized = normalizeRecurringFinanceData(data, referenceDate);
  return calculateMoneyFlow(normalized).safeToSpend;
}

/** Weekly Safe To Spend derived from the canonical monthly value. */
export function getSafeToSpendWeekly(
  data: FinanceData,
  referenceDate = new Date(),
): number {
  return Math.round(getSafeToSpend(data, referenceDate) / WEEKS_PER_MONTH);
}
