import { getUpcomingBills } from "@/lib/finance/bills";
import { getBillPaymentHistory } from "@/lib/finance/billPayments";
import { formatCurrency } from "@/lib/finance/format";
import { isPersonalOwnerRow } from "@/lib/finance/personalIncomeScope";
import { getGoalProgressList } from "@/lib/finance/goals";
import { getSafeToSpend } from "@/lib/finance/safeToSpend";
import type { FinanceData, Transaction } from "@/lib/finance/types";
import { getDisplayCategory, getDisplayMerchant } from "@/lib/transactions/categoryPresentation";
import { isRefundActivity } from "@/lib/transactions/refunds";
import { isConfidentInternalTransfer } from "@/lib/transactions/transferDetection";

export type FinancialInsight = {
  id: string;
  title: string;
  detail: string;
  tone: "positive" | "negative" | "neutral";
  href: string;
};

export type InsightBudgetLimit = {
  category: string;
  amount: number;
};

export type CategoryBudgetSuggestion = {
  category: string;
  amount: number;
  months: number;
};

export type BillPriceIncrease = {
  billId: string;
  name: string;
  previousAverage: number;
  latestAmount: number;
  latestDate: string;
};

const DAY_MS = 86_400_000;
const EXCLUDED_INSIGHT_CATEGORIES = new Set([
  "Transfers",
  "Income",
  "Payroll",
  "Interest",
  "Refund",
  "Credit Card Payment",
  "Loan Payment",
]);

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shiftMonth(reference: Date, offset: number): string {
  return monthKey(new Date(reference.getFullYear(), reference.getMonth() + offset, 1));
}

function confirmedExpenses(data: FinanceData): Transaction[] {
  return (data.transactions ?? []).filter(
    (transaction) =>
      transaction.type === "expense" &&
      transaction.amount !== 0 &&
      isPersonalOwnerRow(transaction.ownerUserId, data.viewerUserId) &&
      !isConfidentInternalTransfer(data, transaction),
  );
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1]! + sorted[middle]!) / 2;
  }
  return sorted[middle]!;
}

function isOutlier(
  amount: number,
  samples: number[],
  minimumSamples: number,
  multiple: number,
  gap: number,
): { typical: number } | null {
  if (samples.length < minimumSamples) {
    return null;
  }
  const typical = median(samples);
  if (typical <= 0 || amount < typical * multiple || amount - typical < gap) {
    return null;
  }
  return { typical };
}

export function findUnusualTransactions(
  data: FinanceData,
  referenceDate = new Date(),
): FinancialInsight[] {
  const today = dateKey(referenceDate);
  const recentStart = dateKey(new Date(referenceDate.getTime() - 14 * DAY_MS));
  const baselineStart = dateKey(new Date(referenceDate.getTime() - 120 * DAY_MS));
  const expenses = confirmedExpenses(data).filter(
    (transaction) =>
      transaction.amount > 0 &&
      !transaction.goalId &&
      !transaction.billId &&
      !isRefundActivity(transaction),
  );
  const baseline = new Map<string, number[]>();
  const overall: number[] = [];

  for (const transaction of expenses) {
    const posted = transaction.date.slice(0, 10);
    if (posted >= recentStart || posted < baselineStart) {
      continue;
    }
    const category = getDisplayCategory(transaction.category);
    if (EXCLUDED_INSIGHT_CATEGORIES.has(category)) {
      continue;
    }
    const samples = baseline.get(category) ?? [];
    samples.push(transaction.amount);
    baseline.set(category, samples);
    overall.push(transaction.amount);
  }

  const outliers: Array<FinancialInsight & { ratio: number }> = [];

  for (const transaction of expenses) {
    const posted = transaction.date.slice(0, 10);
    if (posted < recentStart || posted > today) {
      continue;
    }
    const category = getDisplayCategory(transaction.category);
    if (EXCLUDED_INSIGHT_CATEGORIES.has(category)) {
      continue;
    }
    const categorySamples = baseline.get(category) ?? [];
    const categoryHit = isOutlier(transaction.amount, categorySamples, 3, 2, 40);
    const overallHit = categoryHit
      ? null
      : isOutlier(transaction.amount, overall, 5, 3, 100);
    const hit = categoryHit ?? overallHit;
    if (!hit) {
      continue;
    }
    const merchant = getDisplayMerchant({
      notes: transaction.notes,
      category: transaction.category,
      type: transaction.type,
    });
    const comparison = categoryHit
      ? `The typical ${category} charge over the prior months was ${formatCurrency(hit.typical)} across ${categorySamples.length} confirmed expenses.`
      : `There are not enough earlier ${category} charges to compare, so this uses your overall typical expense of ${formatCurrency(hit.typical)} across ${overall.length} confirmed expenses.`;
    outliers.push({
      ratio: transaction.amount / hit.typical,
      id: `insight-unusual-${category}`,
      title: `Unusual ${category} charge`,
      detail: `${merchant} was ${formatCurrency(transaction.amount)} on ${posted}. ${comparison}`,
      tone: "negative",
      href: "/transactions",
    });
  }

  const seen = new Set<string>();
  return outliers
    .sort((left, right) => right.ratio - left.ratio)
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, 2)
    .map((item) => ({
      id: item.id,
      title: item.title,
      detail: item.detail,
      tone: item.tone,
      href: item.href,
    }));
}

export function findBudgetOverspending(
  data: FinanceData,
  limits: InsightBudgetLimit[],
  referenceDate = new Date(),
): FinancialInsight[] {
  const month = monthKey(referenceDate);
  const spent = new Map<string, number>();

  for (const transaction of confirmedExpenses(data)) {
    if (transaction.date.slice(0, 7) !== month || transaction.goalId) {
      continue;
    }
    const category = getDisplayCategory(transaction.category);
    if (EXCLUDED_INSIGHT_CATEGORIES.has(category)) {
      continue;
    }
    spent.set(category, (spent.get(category) ?? 0) + transaction.amount);
  }

  const limitByCategory = new Map<string, number>();
  for (const limit of limits) {
    const category = getDisplayCategory(limit.category);
    if (
      EXCLUDED_INSIGHT_CATEGORIES.has(category) ||
      !Number.isFinite(limit.amount) ||
      limit.amount <= 0
    ) {
      continue;
    }
    const existing = limitByCategory.get(category);
    limitByCategory.set(
      category,
      existing == null ? limit.amount : Math.min(existing, limit.amount),
    );
  }

  const overs: Array<{ over: number; insight: FinancialInsight }> = [];
  for (const [category, limit] of limitByCategory) {
    const amount = roundCurrency(spent.get(category) ?? 0);
    if (amount <= limit) {
      continue;
    }
    const over = roundCurrency(amount - limit);
    overs.push({
      over,
      insight: {
        id: `insight-budget-${category}`,
        title: `${category} is over budget`,
        detail: `${formatCurrency(amount)} of confirmed ${category} expenses posted in ${month}, against a ${formatCurrency(limit)} limit, so it is ${formatCurrency(over)} over.`,
        tone: "negative",
        href: "/reports",
      },
    });
  }

  return overs
    .sort((left, right) => right.over - left.over)
    .slice(0, 2)
    .map((item) => item.insight);
}

function spendingForMonth(transactions: Transaction[], key: string): number {
  return transactions
    .filter((transaction) => transaction.date.slice(0, 7) === key)
    .reduce((total, transaction) => total + transaction.amount, 0);
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function findSubscriptionPriceIncreases(
  data: FinanceData,
): BillPriceIncrease[] {
  const increases: BillPriceIncrease[] = [];

  for (const bill of data.bills ?? []) {
    if (!bill.recurring) {
      continue;
    }

    const history = getBillPaymentHistory(data, bill.id);
    if (history.length < 2) {
      continue;
    }

    const latest = history[0]!;
    const prior = history.slice(1, 4);
    const previousAverage =
      prior.reduce((total, payment) => total + payment.amount, 0) / prior.length;

    if (
      previousAverage > 0 &&
      latest.amount - previousAverage >= 1 &&
      latest.amount >= previousAverage * 1.08
    ) {
      increases.push({
        billId: bill.id,
        name: bill.name,
        previousAverage: roundCurrency(previousAverage),
        latestAmount: latest.amount,
        latestDate: latest.date,
      });
    }
  }

  return increases;
}

export function suggestCategoryBudgets(
  data: FinanceData,
  referenceDate = new Date(),
): CategoryBudgetSuggestion[] {
  const monthKeys = [1, 2, 3].map((offset) => shiftMonth(referenceDate, -offset));
  const totals = new Map<string, Map<string, number>>();

  for (const transaction of confirmedExpenses(data)) {
    const key = transaction.date.slice(0, 7);
    if (!monthKeys.includes(key)) {
      continue;
    }

    const category = getDisplayCategory(transaction.category);
    if (!category || category === "Transfers" || category === "Other") {
      continue;
    }

    const byMonth = totals.get(category) ?? new Map<string, number>();
    byMonth.set(key, (byMonth.get(key) ?? 0) + transaction.amount);
    totals.set(category, byMonth);
  }

  return [...totals.entries()]
    .map(([category, byMonth]) => {
      const months = [...byMonth.values()].filter((amount) => amount > 0);
      if (months.length < 2) {
        return null;
      }

      const amount = roundCurrency(
        months.reduce((total, value) => total + value, 0) / months.length,
      );
      if (amount < 1) {
        return null;
      }

      return { category, amount, months: months.length };
    })
    .filter((item): item is CategoryBudgetSuggestion => item !== null)
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 4);
}

export function buildFinancialInsights(
  data: FinanceData,
  referenceDate = new Date(),
  budgets: InsightBudgetLimit[] = [],
): FinancialInsight[] {
  const insights: Array<FinancialInsight & { priority: number }> = [];
  const expenses = confirmedExpenses(data);
  const latestKey = shiftMonth(referenceDate, -1);
  const previousKey = shiftMonth(referenceDate, -2);
  const latestSpending = spendingForMonth(expenses, latestKey);
  const previousSpending = spendingForMonth(expenses, previousKey);

  if (latestSpending > 0 && previousSpending > 0) {
    const delta = latestSpending - previousSpending;
    const ratio = delta / previousSpending;
    if (Math.abs(delta) >= 25 && Math.abs(ratio) >= 0.1) {
      const increased = delta > 0;
      insights.push({
        priority: 5,
        id: `insight-spending-${latestKey}`,
        title: increased
          ? "Spending increased compared with the previous month"
          : "Spending decreased compared with the previous month",
        detail: `${latestKey} spending was ${formatCurrency(latestSpending)}, ${
          increased ? "up" : "down"
        } from ${formatCurrency(previousSpending)} in ${previousKey}. These are confirmed expenses, excluding transfers.`,
        tone: increased ? "negative" : "positive",
        href: "/reports",
      });
    }
  }

  for (const increase of findSubscriptionPriceIncreases(data)
    .sort(
      (left, right) =>
        right.latestAmount - right.previousAverage - (left.latestAmount - left.previousAverage),
    )
    .slice(0, 2)) {
    insights.push({
      priority: 3,
      id: `insight-price-${increase.billId}`,
      title: `${increase.name} increased in price`,
      detail: `The latest recorded payment was ${formatCurrency(increase.latestAmount)} on ${increase.latestDate}, above the earlier average of ${formatCurrency(increase.previousAverage)}. Review the bill before changing it.`,
      tone: "negative",
      href: "/bills",
    });
  }

  const horizon = referenceDate.getTime() + 14 * DAY_MS;
  const upcoming = getUpcomingBills(data, referenceDate).filter((bill) => {
    if (bill.status === "overdue") {
      return true;
    }
    return bill.dueDate != null && bill.dueDate.getTime() <= horizon;
  });
  const upcomingTotal = upcoming.reduce(
    (total, bill) => total + (bill.remainingAmount || bill.amount),
    0,
  );
  const safeToSpend = getSafeToSpend(data, referenceDate);

  if (upcomingTotal > 0 && safeToSpend < upcomingTotal) {
    const names = upcoming
      .slice(0, 3)
      .map((bill) => bill.name)
      .join(", ");
    insights.push({
      priority: 1,
      id: "insight-bills-vs-cash",
      title: "Upcoming bills may exceed available cash",
      detail: `Bills due within 14 days total ${formatCurrency(upcomingTotal)} (${names}). Safe to Spend is ${formatCurrency(safeToSpend)}, from the current plan and balances.`,
      tone: "negative",
      href: "/bills",
    });
  }

  for (const over of findBudgetOverspending(data, budgets, referenceDate)) {
    insights.push({ priority: 2, ...over });
  }

  for (const unusual of findUnusualTransactions(data, referenceDate)) {
    insights.push({ priority: 4, ...unusual });
  }

  const planAmount = data.incomePlan?.paycheckAmount ?? 0;
  if (planAmount > 0) {
    const cutoff = dateKey(new Date(referenceDate.getTime() - 45 * DAY_MS));
    const changed = (data.transactions ?? [])
      .filter(
        (transaction) =>
          transaction.type === "income" &&
          transaction.date >= cutoff &&
          !isRefundActivity(transaction) &&
          !isConfidentInternalTransfer(data, transaction) &&
          isPersonalOwnerRow(transaction.ownerUserId, data.viewerUserId) &&
          Math.abs(transaction.amount - planAmount) >= 1 &&
          (transaction.amount >= planAmount * 1.08 || transaction.amount <= planAmount * 0.92),
      )
      .sort((left, right) => right.date.localeCompare(left.date))[0];

    if (changed) {
      const higher = changed.amount > planAmount;
      insights.push({
        priority: 6,
        id: `insight-paycheck-${changed.id}`,
        title: higher
          ? "A paycheck was higher than expected"
          : "A paycheck was lower than expected",
        detail: `${formatCurrency(changed.amount)} on ${changed.date.slice(0, 10)} ${
          higher ? "is above" : "is below"
        } your Income Plan amount of ${formatCurrency(planAmount)}.`,
        tone: higher ? "positive" : "negative",
        href: "/income",
      });
    }
  }

  const goals = getGoalProgressList(data);
  for (const goal of goals) {
    if (goal.isComplete || goal.monthlyContribution <= 0) {
      continue;
    }

    const source = data.savingsGoals.find((item) => item.id === goal.id);
    if (!source?.createdAt) {
      continue;
    }

    const created = new Date(source.createdAt);
    if (Number.isNaN(created.getTime())) {
      continue;
    }

    const months = (referenceDate.getTime() - created.getTime()) / (30.44 * DAY_MS);
    if (months < 2) {
      continue;
    }

    const expected = goal.monthlyContribution * months;
    if (goal.current + 1 < expected * 0.75) {
      insights.push({
        priority: 7,
        id: `insight-goal-${goal.id}`,
        title: `${goal.name} is behind schedule`,
        detail: `${formatCurrency(goal.current)} is saved. At the recorded pace of ${formatCurrency(goal.monthlyContribution)} per month since ${source.createdAt.slice(0, 10)}, about ${formatCurrency(expected)} would have been saved.`,
        tone: "negative",
        href: "/savings",
      });
      break;
    }
  }

  return insights
    .sort((left, right) => left.priority - right.priority || left.title.localeCompare(right.title))
    .slice(0, 6)
    .map((insight) => ({
      id: insight.id,
      title: insight.title,
      detail: insight.detail,
      tone: insight.tone,
      href: insight.href,
    }));
}

export function budgetSuggestionDetail(suggestion: CategoryBudgetSuggestion): string {
  return `${suggestion.category} averaged ${formatCurrency(suggestion.amount)} across ${suggestion.months} months of confirmed spending. This is a suggestion, not a saved limit, until you keep it.`;
}
