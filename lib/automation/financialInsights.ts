import { getUpcomingBills } from "@/lib/finance/bills";
import { getBillPaymentHistory } from "@/lib/finance/billPayments";
import { formatCurrency } from "@/lib/finance/format";
import { getGoalProgressList } from "@/lib/finance/goals";
import { getSafeToSpend } from "@/lib/finance/safeToSpend";
import type { FinanceData, Transaction } from "@/lib/finance/types";
import { getDisplayCategory } from "@/lib/transactions/categoryPresentation";
import { isConfidentInternalTransfer } from "@/lib/transactions/transferDetection";

export type FinancialInsight = {
  id: string;
  title: string;
  detail: string;
  tone: "positive" | "negative" | "neutral";
  href: string;
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

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(reference: Date, offset: number): string {
  return monthKey(new Date(reference.getFullYear(), reference.getMonth() + offset, 1));
}

function confirmedExpenses(data: FinanceData): Transaction[] {
  return (data.transactions ?? []).filter(
    (transaction) =>
      transaction.type === "expense" &&
      transaction.amount > 0 &&
      !isConfidentInternalTransfer(data, transaction),
  );
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
): FinancialInsight[] {
  const insights: FinancialInsight[] = [];
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
        id: `insight-spending-${latestKey}`,
        title: increased
          ? "Spending increased compared with the previous month"
          : "Spending decreased compared with the previous month",
        detail: `${latestKey} spending was ${formatCurrency(latestSpending)}, ${
          increased ? "up" : "down"
        } from ${formatCurrency(previousSpending)} in ${previousKey}. These are confirmed expenses.`,
        tone: increased ? "negative" : "positive",
        href: "/reports",
      });
    }
  }

  for (const increase of findSubscriptionPriceIncreases(data)) {
    insights.push({
      id: `insight-price-${increase.billId}`,
      title: `${increase.name} increased in price`,
      detail: `The latest recorded payment was ${formatCurrency(increase.latestAmount)}, above the earlier average of ${formatCurrency(increase.previousAverage)}. Review the bill before changing it.`,
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
    insights.push({
      id: "insight-bills-vs-cash",
      title: "Upcoming bills may exceed available cash",
      detail: `Bills due within 14 days total ${formatCurrency(upcomingTotal)}. Safe to Spend is ${formatCurrency(safeToSpend)}, which is an estimate from your current plan and balances.`,
      tone: "negative",
      href: "/bills",
    });
  }

  const planAmount = data.incomePlan?.paycheckAmount ?? 0;
  if (planAmount > 0) {
    const cutoff = new Date(referenceDate.getTime() - 45 * DAY_MS)
      .toISOString()
      .slice(0, 10);
    const higher = (data.transactions ?? [])
      .filter(
        (transaction) =>
          transaction.type === "income" &&
          transaction.date >= cutoff &&
          transaction.amount > planAmount * 1.08 &&
          !isConfidentInternalTransfer(data, transaction),
      )
      .sort((left, right) => right.date.localeCompare(left.date))[0];

    if (higher) {
      insights.push({
        id: `insight-paycheck-${higher.id}`,
        title: "A paycheck was higher than expected",
        detail: `${formatCurrency(higher.amount)} on ${higher.date} is above your Income Plan amount of ${formatCurrency(planAmount)}.`,
        tone: "positive",
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
        id: `insight-goal-${goal.id}`,
        title: `${goal.name} is behind schedule`,
        detail: `${formatCurrency(goal.current)} is saved. At ${formatCurrency(goal.monthlyContribution)} per month since ${source.createdAt.slice(0, 10)}, the pace would be about ${formatCurrency(expected)}.`,
        tone: "negative",
        href: "/savings",
      });
      break;
    }
  }

  return insights.slice(0, 5);
}

export function budgetSuggestionDetail(suggestion: CategoryBudgetSuggestion): string {
  return `${suggestion.category} averaged ${formatCurrency(suggestion.amount)} across ${suggestion.months} months of confirmed spending. This is a suggestion, not a saved limit, until you keep it.`;
}
