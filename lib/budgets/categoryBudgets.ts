import {
  budgetMonthlyEquivalent,
  budgetPeriodDaysElapsed,
  budgetPeriodDaysRemaining,
  budgetPeriodLengthDays,
  BUDGET_FREQUENCY_LABELS,
  currentBudgetPeriod,
  formatBudgetPeriodLabel,
  normalizeBudgetSchedule,
  previousBudgetPeriod,
  roundBudgetCurrency,
  type BudgetFrequency,
} from "@/lib/budgets/budgetPeriod";
import { isPersonalOwnerRow } from "@/lib/finance/personalIncomeScope";
import type { FinanceData, Transaction } from "@/lib/finance/types";
import { getDisplayCategory } from "@/lib/transactions/categoryPresentation";
import { isRefundActivity } from "@/lib/transactions/refunds";
import { filterRealExpenseTransactions } from "@/lib/transactions/transferDetection";

const EXCLUDED_CATEGORIES = new Set([
  "Transfers",
  "Income",
  "Payroll",
  "Interest",
  "Refund",
  "Credit Card Payment",
]);

export type CategoryBudgetSuggestion = {
  category: string;
  suggestedLimit: number;
  months: number;
};

export type CategoryBudgetLimitInput = {
  category: string;
  amount: number;
  frequency?: BudgetFrequency;
  anchorDate?: string | null;
  weekday?: number | null;
  monthDays?: number[] | [number, number] | null;
  intervalDays?: number | null;
};

export type CategoryBudgetView = {
  category: string;
  limit: number;
  /** Base limit plus optional previous-period surplus when rollover is on. */
  effectiveLimit: number;
  rolloverCredit: number;
  rolloverEnabled: boolean;
  spent: number;
  remaining: number;
  progress: number;
  overspent: boolean;
  alert: string | null;
  frequency: BudgetFrequency;
  frequencyLabel: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  anchorDate: string | null;
  weekday: number | null;
  monthDays: [number, number] | null;
  intervalDays: number | null;
  monthlyEquivalent: number;
  daysRemaining: number;
  daysElapsed: number;
  periodLengthDays: number;
  averageDailySpent: number;
  recommendedDailyRemaining: number;
  projectedEndOfPeriodSpent: number;
  estimatedOverageOrSurplus: number;
  previousPeriodSpent: number;
  /** 1 = on pace; >1 spending faster than linear period pace. */
  paceRatio: number | null;
};

function roundCurrency(value: number): number {
  return roundBudgetCurrency(value);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(reference: Date, offset: number): string {
  return monthKey(new Date(reference.getFullYear(), reference.getMonth() + offset, 1));
}

function ownedTransaction(data: FinanceData, transaction: Transaction): boolean {
  return isPersonalOwnerRow(transaction.ownerUserId, data.viewerUserId);
}

function spendingCategory(transaction: Transaction): string | null {
  const display = getDisplayCategory(transaction.category);
  if (!display || EXCLUDED_CATEGORIES.has(display)) {
    return null;
  }
  return display;
}

function refundBucket(transaction: Transaction): string | null {
  const display = getDisplayCategory(transaction.category);
  if (
    display === "Income" ||
    display === "Payroll" ||
    display === "Interest" ||
    display === "Transfers"
  ) {
    return null;
  }
  if (display === "Refund") {
    return null;
  }
  return display;
}

function matchesPostedDate(date: string, matches: (posted: string) => boolean): boolean {
  return matches(date.slice(0, 10));
}

/**
 * Net category spending for transactions whose posted date matches.
 * Transfers and another household member's rows are excluded.
 * Merchant refunds reduce the matching spending category.
 * A date is counted once: the caller supplies one window.
 */
function netCategorySpendingWhere(
  data: FinanceData,
  matches: (posted: string) => boolean,
): Map<string, number> {
  const totals = new Map<string, number>();
  const expenses = filterRealExpenseTransactions(
    data,
    (data.transactions ?? []).filter(
      (transaction) =>
        transaction.type === "expense" &&
        !transaction.goalId &&
        matchesPostedDate(transaction.date, matches) &&
        ownedTransaction(data, transaction),
    ),
  );

  for (const transaction of expenses) {
    const category = spendingCategory(transaction);
    if (!category) {
      continue;
    }
    totals.set(category, (totals.get(category) ?? 0) + transaction.amount);
  }

  for (const transaction of data.transactions ?? []) {
    if (
      transaction.type !== "income" ||
      !isRefundActivity(transaction) ||
      !matchesPostedDate(transaction.date, matches) ||
      !ownedTransaction(data, transaction)
    ) {
      continue;
    }

    const category = refundBucket(transaction);
    if (!category) {
      continue;
    }
    totals.set(
      category,
      (totals.get(category) ?? 0) - Math.abs(transaction.amount),
    );
  }

  return totals;
}

/**
 * Net category spending for one calendar month.
 * Transfers and another household member's rows are excluded.
 * Merchant refunds reduce the matching spending category.
 */
export function netCategorySpending(
  data: FinanceData,
  month: string,
): Map<string, number> {
  return netCategorySpendingWhere(data, (posted) => posted.slice(0, 7) === month);
}

export function netCategorySpendingInPeriod(
  data: FinanceData,
  period: { start: string; end: string },
): Map<string, number> {
  return netCategorySpendingWhere(
    data,
    (posted) => posted >= period.start && posted <= period.end,
  );
}

export function suggestCategoryBudgetLimits(
  data: FinanceData,
  referenceDate = new Date(),
): CategoryBudgetSuggestion[] {
  const monthKeys = [1, 2, 3].map((offset) => shiftMonth(referenceDate, -offset));
  const byCategory = new Map<string, number[]>();

  for (const key of monthKeys) {
    for (const [category, amount] of netCategorySpending(data, key)) {
      if (amount <= 0) {
        continue;
      }
      const samples = byCategory.get(category) ?? [];
      samples.push(amount);
      byCategory.set(category, samples);
    }
  }

  return [...byCategory.entries()]
    .map(([category, samples]) => {
      if (samples.length < 2) {
        return null;
      }
      const suggestedLimit = roundCurrency(
        samples.reduce((total, value) => total + value, 0) / samples.length,
      );
      if (suggestedLimit < 1) {
        return null;
      }
      return { category, suggestedLimit, months: samples.length };
    })
    .filter((item): item is CategoryBudgetSuggestion => item !== null)
    .sort((left, right) => right.suggestedLimit - left.suggestedLimit);
}

export function buildCategoryBudgetViews(
  limits: CategoryBudgetLimitInput[],
  data: FinanceData,
  referenceDate = new Date(),
  options?: { rolloverCategories?: ReadonlySet<string> },
): CategoryBudgetView[] {
  const limitsByCategory = new Map<
    string,
    { limit: number; schedule: ReturnType<typeof normalizeBudgetSchedule> }
  >();

  for (const item of limits) {
    const category = getDisplayCategory(item.category);
    if (
      !category ||
      EXCLUDED_CATEGORIES.has(category) ||
      !Number.isFinite(item.amount) ||
      item.amount < 0
    ) {
      continue;
    }
    // Keep one limit per display category. A later edit replaces the earlier one.
    limitsByCategory.set(category, {
      limit: roundCurrency(item.amount),
      schedule: normalizeBudgetSchedule(item),
    });
  }

  const month = monthKey(referenceDate);

  return [...limitsByCategory.entries()]
    .map(([category, entry]) => {
      const period = currentBudgetPeriod(entry.schedule, referenceDate);
      const previous = previousBudgetPeriod(entry.schedule, referenceDate);
      const spentByCategory =
        entry.schedule.frequency === "monthly"
          ? netCategorySpending(data, month)
          : netCategorySpendingInPeriod(data, period);
      const previousSpentByCategory = netCategorySpendingInPeriod(data, previous);
      const spent = roundCurrency(spentByCategory.get(category) ?? 0);
      const previousPeriodSpent = roundCurrency(
        previousSpentByCategory.get(category) ?? 0,
      );
      const rolloverEnabled = options?.rolloverCategories?.has(category) === true;
      const rolloverCredit = rolloverEnabled
        ? roundCurrency(Math.max(0, entry.limit - previousPeriodSpent))
        : 0;
      // Rollover expands allowance only — never Safe to Spend or bank cash.
      const effectiveLimit = roundCurrency(entry.limit + rolloverCredit);
      const remaining = roundCurrency(effectiveLimit - spent);
      const progress =
        effectiveLimit > 0
          ? Math.max(0, Math.round((spent / effectiveLimit) * 100))
          : 0;
      const overspent = spent > effectiveLimit;
      const periodLengthDays = budgetPeriodLengthDays(period);
      const daysElapsed = budgetPeriodDaysElapsed(period, referenceDate);
      const daysRemaining = budgetPeriodDaysRemaining(period, referenceDate);
      const averageDailySpent =
        daysElapsed > 0 ? roundCurrency(spent / daysElapsed) : 0;
      const recommendedDailyRemaining =
        daysRemaining > 0 ? roundCurrency(Math.max(remaining, 0) / daysRemaining) : 0;
      const projectedEndOfPeriodSpent =
        daysElapsed > 0
          ? roundCurrency(averageDailySpent * periodLengthDays)
          : spent;
      const estimatedOverageOrSurplus = roundCurrency(
        effectiveLimit - projectedEndOfPeriodSpent,
      );
      const expectedSpent =
        effectiveLimit > 0 && periodLengthDays > 0
          ? (effectiveLimit * daysElapsed) / periodLengthDays
          : 0;
      const paceRatio =
        expectedSpent > 0 ? roundCurrency(spent / expectedSpent) : null;
      return {
        category,
        limit: entry.limit,
        effectiveLimit,
        rolloverCredit,
        rolloverEnabled,
        spent,
        remaining,
        progress,
        overspent,
        alert: overspent
          ? "Over budget"
          : paceRatio != null && paceRatio >= 1.15
            ? "Spending faster than pace"
            : progress >= 80
              ? "Approaching limit"
              : null,
        frequency: entry.schedule.frequency,
        frequencyLabel: BUDGET_FREQUENCY_LABELS[entry.schedule.frequency],
        periodStart: period.start,
        periodEnd: period.end,
        periodLabel: formatBudgetPeriodLabel(period),
        anchorDate: entry.schedule.anchorDate,
        weekday: entry.schedule.weekday,
        monthDays: entry.schedule.monthDays,
        intervalDays: entry.schedule.intervalDays,
        monthlyEquivalent: budgetMonthlyEquivalent(entry.limit, entry.schedule),
        daysRemaining,
        daysElapsed,
        periodLengthDays,
        averageDailySpent,
        recommendedDailyRemaining,
        projectedEndOfPeriodSpent,
        estimatedOverageOrSurplus,
        previousPeriodSpent,
        paceRatio,
      };
    })
    .sort((left, right) => right.spent - left.spent);
}
