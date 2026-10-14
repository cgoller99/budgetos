import {
  budgetMonthlyEquivalent,
  BUDGET_FREQUENCY_LABELS,
  currentBudgetPeriod,
  formatBudgetPeriodLabel,
  normalizeBudgetSchedule,
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
};

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
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
      const spentByCategory =
        entry.schedule.frequency === "monthly"
          ? netCategorySpending(data, month)
          : netCategorySpendingInPeriod(data, period);
      const spent = roundCurrency(spentByCategory.get(category) ?? 0);
      const remaining = roundCurrency(entry.limit - spent);
      const progress =
        entry.limit > 0 ? Math.max(0, Math.round((spent / entry.limit) * 100)) : 0;
      const overspent = spent > entry.limit;
      return {
        category,
        limit: entry.limit,
        spent,
        remaining,
        progress,
        overspent,
        alert: overspent ? "Over budget" : null,
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
      };
    })
    .sort((left, right) => right.spent - left.spent);
}
