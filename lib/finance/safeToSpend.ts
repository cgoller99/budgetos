import { calculateMoneyFlow } from "@/lib/finance/moneyFlow";
import type { FinanceData } from "@/lib/finance/types";
import { normalizeRecurringFinanceData } from "@/lib/recurring";

/** Weeks per month used consistently for weekly spending allowance display. */
export const WEEKS_PER_MONTH = 4.33;

/**
 * Canonical monthly Safe to Spend — budget waterfall capped by eligible
 * available cash (manual checking/cash and opted-in savings, Plaid available
 * when present). Not interchangeable with until-payday cash or weekly left.
 */
export function getSafeToSpend(data: FinanceData, referenceDate = new Date()): number {
  const normalized = normalizeRecurringFinanceData(data, referenceDate);
  return calculateMoneyFlow(normalized, referenceDate).safeToSpend;
}

/**
 * Weekly spending allowance = monthly Safe to Spend ÷ WEEKS_PER_MONTH.
 * Label as a weekly allowance — never as "until paycheck" cash.
 */
export function getSafeToSpendWeekly(
  data: FinanceData,
  referenceDate = new Date(),
): number {
  return Math.round(getSafeToSpend(data, referenceDate) / WEEKS_PER_MONTH);
}
