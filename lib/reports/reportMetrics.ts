import type { FinanceData, Transaction } from "@/lib/finance/types";
import { calculateMonthlyIncome } from "@/lib/calculations/cashFlow";
import { withEffectiveIncome } from "@/lib/finance/effectiveIncome";

export type MonthlyTrendPoint = {
  key: string;
  label: string;
  spending: number;
  income: number;
  savings: number;
};

export type CategoryBreakdownItem = {
  category: string;
  amount: number;
  percent: number;
};

const MONTH_COUNT = 6;

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function getLastMonths(count: number, reference = new Date()): MonthlyTrendPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const offset = count - 1 - index;
    const date = new Date(reference.getFullYear(), reference.getMonth() - offset, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    return {
      key,
      label: date.toLocaleDateString("en-US", { month: "short" }),
      spending: 0,
      income: 0,
      savings: 0,
    };
  });
}

function transactionsInMonth(
  transactions: Transaction[],
  key: string,
): Transaction[] {
  return transactions.filter((transaction) => monthKey(transaction.date) === key);
}

export function computeMonthlyTrends(
  data: FinanceData,
  reference = new Date(),
): MonthlyTrendPoint[] {
  const months = getLastMonths(MONTH_COUNT, reference);
  const currentKey = `${reference.getFullYear()}-${String(reference.getMonth() + 1).padStart(2, "0")}`;

  for (const month of months) {
    const monthTransactions = transactionsInMonth(data.transactions, month.key);

    month.spending = monthTransactions
      .filter((transaction) => transaction.type === "expense" && !transaction.goalId)
      .reduce((total, transaction) => total + transaction.amount, 0);

    month.income = monthTransactions
      .filter((transaction) => transaction.type === "income")
      .reduce((total, transaction) => total + transaction.amount, 0);

    month.savings = monthTransactions
      .filter((transaction) => transaction.type === "expense" && transaction.goalId)
      .reduce((total, transaction) => total + transaction.amount, 0);

    if (month.key === currentKey) {
      const projectedIncome = calculateMonthlyIncome(
        withEffectiveIncome(data),
        reference,
      );
      month.income = Math.max(month.income, projectedIncome);
    }
  }

  return months;
}

export function computeCategoryBreakdown(
  data: FinanceData,
): CategoryBreakdownItem[] {
  const totals = new Map<string, number>();

  for (const transaction of data.transactions) {
    if (transaction.type !== "expense" || transaction.goalId) {
      continue;
    }

    const category = transaction.category.trim() || "Other";
    totals.set(category, (totals.get(category) ?? 0) + transaction.amount);
  }

  const grandTotal = Array.from(totals.values()).reduce(
    (sum, amount) => sum + amount,
    0,
  );

  return Array.from(totals.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percent: grandTotal > 0 ? (amount / grandTotal) * 100 : 0,
    }))
    .sort((left, right) => right.amount - left.amount);
}

export function computeTotalGoalSavings(data: FinanceData): number {
  return data.savingsGoals.reduce((total, goal) => total + goal.current, 0);
}

function escapeCsvValue(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function accountName(data: FinanceData, accountId: string): string {
  return data.accounts.find((account) => account.id === accountId)?.name ?? "";
}

export function buildTransactionsCsv(data: FinanceData): string {
  const headers = ["Date", "Type", "Category", "Amount", "Account", "Notes"];
  const rows = [...data.transactions]
    .sort((left, right) => right.date.localeCompare(left.date))
    .map((transaction) => [
      transaction.date,
      transaction.type,
      transaction.category,
      transaction.amount.toFixed(2),
      accountName(data, transaction.accountId),
      transaction.notes,
    ]);

  return [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvValue(String(cell))).join(","))
    .join("\n");
}

export function downloadTransactionsCsv(data: FinanceData, filename?: string): void {
  const csv = buildTransactionsCsv(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateStamp = new Date().toISOString().slice(0, 10);

  link.href = url;
  link.download = filename ?? `buxme-transactions-${dateStamp}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function getTrendMaxValue(points: MonthlyTrendPoint[]): number {
  const values = points.flatMap((point) => [
    point.spending,
    point.income,
    point.savings,
  ]);

  return Math.max(...values, 1);
}
