import {
  dateInBudgetPeriod,
  type BudgetPeriod,
} from "@/lib/budgets/budgetPeriod";
import type { CategoryBudgetView } from "@/lib/budgets/categoryBudgets";
import { isPersonalOwnerRow } from "@/lib/finance/personalIncomeScope";
import type { FinanceData, Transaction } from "@/lib/finance/types";
import { getDisplayCategory } from "@/lib/transactions/categoryPresentation";
import { filterRealExpenseTransactions } from "@/lib/transactions/transferDetection";

const FIXED_CATEGORIES = new Set([
  "Rent",
  "Mortgage",
  "Utilities",
  "Insurance",
  "Phone",
  "Internet",
  "Subscriptions",
  "Childcare",
  "Loan Payment",
  "Debt Payment",
]);

export type BudgetMerchantSpend = {
  merchant: string;
  amount: number;
  count: number;
};

export type BudgetCategoryTransaction = {
  id: string;
  date: string;
  amount: number;
  merchant: string;
  notes: string;
};

export type BudgetHealth = {
  onTrackCount: number;
  approachingCount: number;
  overspentCount: number;
  fixedMonthlyEquivalent: number;
  flexibleMonthlyEquivalent: number;
  healthLabel: "healthy" | "watch" | "overspent";
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function ownedExpenseTransactions(
  data: FinanceData,
  category: string,
  period: BudgetPeriod,
): Transaction[] {
  return filterRealExpenseTransactions(
    data,
    (data.transactions ?? []).filter(
      (transaction) =>
        transaction.type === "expense" &&
        !transaction.goalId &&
        isPersonalOwnerRow(transaction.ownerUserId, data.viewerUserId) &&
        getDisplayCategory(transaction.category) === category &&
        dateInBudgetPeriod(transaction.date.slice(0, 10), period),
    ),
  );
}

function merchantLabel(transaction: Transaction): string {
  const notes = transaction.notes?.trim();
  if (notes && !notes.toLowerCase().startsWith("income plan")) {
    return notes.length > 48 ? `${notes.slice(0, 45)}…` : notes;
  }
  return getDisplayCategory(transaction.category) || "Purchase";
}

export function listBudgetCategoryTransactions(
  data: FinanceData,
  view: CategoryBudgetView,
): BudgetCategoryTransaction[] {
  return ownedExpenseTransactions(data, view.category, {
    start: view.periodStart,
    end: view.periodEnd,
  })
    .map((transaction) => ({
      id: transaction.id,
      date: transaction.date.slice(0, 10),
      amount: round(transaction.amount),
      merchant: merchantLabel(transaction),
      notes: transaction.notes ?? "",
    }))
    .sort((left, right) => right.date.localeCompare(left.date));
}

export function topMerchantsForBudget(
  data: FinanceData,
  view: CategoryBudgetView,
  limit = 5,
): BudgetMerchantSpend[] {
  const totals = new Map<string, { amount: number; count: number }>();
  for (const transaction of ownedExpenseTransactions(data, view.category, {
    start: view.periodStart,
    end: view.periodEnd,
  })) {
    const merchant = merchantLabel(transaction);
    const existing = totals.get(merchant) ?? { amount: 0, count: 0 };
    existing.amount += transaction.amount;
    existing.count += 1;
    totals.set(merchant, existing);
  }
  return [...totals.entries()]
    .map(([merchant, value]) => ({
      merchant,
      amount: round(value.amount),
      count: value.count,
    }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, limit);
}

/** Flag spend spikes vs previous period when prior spend is meaningful. */
export function unusualBudgetSpend(view: CategoryBudgetView): string | null {
  if (view.previousPeriodSpent <= 0) {
    return null;
  }
  if (view.spent >= view.previousPeriodSpent * 1.5 && view.spent - view.previousPeriodSpent >= 25) {
    return `Spending is ${formatPctAbove(view.spent, view.previousPeriodSpent)} higher than the previous period.`;
  }
  return null;
}

function formatPctAbove(current: number, previous: number): string {
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${pct}%`;
}

export function buildBudgetHealth(views: CategoryBudgetView[]): BudgetHealth {
  const overspentCount = views.filter((view) => view.overspent).length;
  const approachingCount = views.filter(
    (view) => !view.overspent && (view.progress >= 80 || (view.paceRatio ?? 0) >= 1.15),
  ).length;
  const onTrackCount = Math.max(0, views.length - overspentCount - approachingCount);
  const fixedMonthlyEquivalent = round(
    views
      .filter((view) => FIXED_CATEGORIES.has(view.category))
      .reduce((total, view) => total + view.monthlyEquivalent, 0),
  );
  const flexibleMonthlyEquivalent = round(
    views
      .filter((view) => !FIXED_CATEGORIES.has(view.category))
      .reduce((total, view) => total + view.monthlyEquivalent, 0),
  );
  return {
    onTrackCount,
    approachingCount,
    overspentCount,
    fixedMonthlyEquivalent,
    flexibleMonthlyEquivalent,
    healthLabel:
      overspentCount > 0 ? "overspent" : approachingCount > 0 ? "watch" : "healthy",
  };
}

export function isFixedBudgetCategory(category: string): boolean {
  return FIXED_CATEGORIES.has(category);
}
