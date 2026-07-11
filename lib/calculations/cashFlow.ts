import type { FinanceData } from "@/lib/finance/types";
import { calculateMonthlySpendingForMoneyFlow } from "@/lib/calculations/spending";
import { calculateMonthlyIncome } from "@/lib/calculations/income";
import type { CashFlowResult } from "./types";

export {
  calculateAnnualIncome,
  calculateAverageLedgerMonthlyIncome,
  calculateMonthlyIncome,
  calculateRecurringMonthlyIncome,
  getCurrentMonthLedgerIncomeTotal,
  getIncomeCalculationMode,
} from "@/lib/calculations/income";

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

export function calculateMonthlySpending(
  data: FinanceData,
  referenceDate = new Date(),
): number {
  return calculateMonthlySpendingForMoneyFlow(data, referenceDate);
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
