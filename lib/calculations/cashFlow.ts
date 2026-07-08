import type { FinanceData } from "@/lib/finance/types";
import { toMonthlyAmount } from "@/lib/calculations/monthlyAmount";
import {
  getEffectiveIncomeSources,
  isIncomeSourceActive,
} from "@/lib/finance/effectiveIncome";
import { sumTransactionsByType } from "@/lib/transactions";
import type { CashFlowResult } from "./types";

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function toBarWidthPercent(amount: number, maxAmount: number): number {
  if (maxAmount <= 0) {
    return 0;
  }

  const barDisplayScale = 0.85;
  return Math.round((amount / maxAmount) * 100 * barDisplayScale);
}

function isRecurringPaycheckLedgerIncome(notes: string | undefined): boolean {
  const normalized = (notes ?? "").toLowerCase();
  return normalized.includes("paycheck received");
}

export function calculateMonthlyIncome(
  data: FinanceData,
  referenceDate = new Date(),
): number {
  const recurringSources = getEffectiveIncomeSources(data).filter(
    isIncomeSourceActive,
  );
  const recurring = sum(
    recurringSources.map((source) =>
      toMonthlyAmount(source.amount, source.frequency),
    ),
  );

  if (recurringSources.length > 0) {
    return recurring;
  }

  const ledgerIncome = sumTransactionsByType(data, "income", referenceDate);
  return recurring + ledgerIncome;
}

export function calculateMonthlySpending(
  data: FinanceData,
  referenceDate = new Date(),
): number {
  const recurring = sum(
    (data.bills ?? [])
      .filter((bill) => bill.recurring)
      .map((bill) => toMonthlyAmount(bill.amount, bill.frequency ?? "monthly")),
  );
  const ledgerExpenses = sumTransactionsByType(data, "expense", referenceDate);
  return recurring + ledgerExpenses;
}

export function calculateNetCashFlow(
  data: FinanceData,
  referenceDate = new Date(),
): number {
  return (
    calculateMonthlyIncome(data, referenceDate) -
    calculateMonthlySpending(data, referenceDate)
  );
}

export function calculateCashFlow(
  data: FinanceData,
  referenceDate = new Date(),
): CashFlowResult {
  const income = calculateMonthlyIncome(data, referenceDate);
  const spending = calculateMonthlySpending(data, referenceDate);
  const flowMax = Math.max(income, spending, 1);

  return {
    income,
    spending,
    netFlow: income - spending,
    incomeBarWidthPercent: toBarWidthPercent(income, flowMax),
    spendingBarWidthPercent: toBarWidthPercent(spending, flowMax),
  };
}

export { isRecurringPaycheckLedgerIncome };
