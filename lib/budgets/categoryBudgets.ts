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

export type CategoryBudgetView = {
  category: string;
  limit: number;
  spent: number;
  remaining: number;
  progress: number;
  overspent: boolean;
  alert: string | null;
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

/**
 * Net category spending for one month.
 * Transfers and another household member's rows are excluded.
 * Merchant refunds reduce the matching spending category.
 */
export function netCategorySpending(
  data: FinanceData,
  month: string,
): Map<string, number> {
  const totals = new Map<string, number>();
  const expenses = filterRealExpenseTransactions(
    data,
    (data.transactions ?? []).filter(
      (transaction) =>
        transaction.type === "expense" &&
        !transaction.goalId &&
        transaction.date.slice(0, 7) === month &&
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
      transaction.date.slice(0, 7) !== month ||
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
  limits: Array<{ category: string; amount: number }>,
  data: FinanceData,
  referenceDate = new Date(),
): CategoryBudgetView[] {
  const spentByCategory = netCategorySpending(data, monthKey(referenceDate));

  return limits
    .filter((item) => item.category.trim() && item.amount >= 0)
    .map((item) => {
      const spent = roundCurrency(spentByCategory.get(item.category) ?? 0);
      const remaining = roundCurrency(item.amount - spent);
      const progress =
        item.amount > 0 ? Math.max(0, Math.round((spent / item.amount) * 100)) : 0;
      const overspent = spent > item.amount;
      return {
        category: item.category,
        limit: roundCurrency(item.amount),
        spent,
        remaining,
        progress,
        overspent,
        alert: overspent ? "Over budget" : null,
      };
    })
    .sort((left, right) => right.spent - left.spent);
}
