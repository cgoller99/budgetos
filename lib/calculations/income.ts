import type { FinanceData } from "@/lib/finance/types";
import { toMonthlyAmount } from "@/lib/calculations/monthlyAmount";
import {
  getAveragePersonalLedgerIncome,
  getPersonalLedgerIncomeForMonth,
} from "@/lib/calculations/incomeLedger";
import {
  estimateMonthlyIncomeFromPayrollDeposits,
} from "@/lib/calculations/payrollIncome";
import {
  getEffectiveIncomeSources,
  isIncomeSourceActive,
} from "@/lib/finance/effectiveIncome";
import { filterPersonalIncomeSources } from "@/lib/finance/personalIncomeScope";

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function hasPlaidIncomeHistory(data: FinanceData): boolean {
  return (data.transactions ?? []).some(
    (transaction) =>
      Boolean(transaction.externalTransactionId) && transaction.type === "income",
  );
}

export function calculateRecurringMonthlyIncome(data: FinanceData): number {
  return sum(
    getEffectiveIncomeSources(data)
      .filter(isIncomeSourceActive)
      .map((source) => toMonthlyAmount(source.amount, source.frequency)),
  );
}

export function calculateAverageLedgerMonthlyIncome(
  data: FinanceData,
  referenceDate = new Date(),
  months = 3,
): number {
  return getAveragePersonalLedgerIncome(data, referenceDate, months);
}

export function calculateMonthlyIncome(
  data: FinanceData,
  referenceDate = new Date(),
): number {
  const recurringSources = getEffectiveIncomeSources(data).filter(isIncomeSourceActive);
  const recurring = sum(
    recurringSources.map((source) =>
      toMonthlyAmount(source.amount, source.frequency),
    ),
  );

  const payrollEstimate = estimateMonthlyIncomeFromPayrollDeposits(
    data,
    referenceDate,
  );
  const hasPlaidIncome = hasPlaidIncomeHistory(data);

  if (recurringSources.length === 0) {
    if (payrollEstimate && payrollEstimate > 0) {
      return payrollEstimate;
    }

    const averageLedger = getAveragePersonalLedgerIncome(data, referenceDate);
    if (averageLedger > 0) {
      return averageLedger;
    }

    return getPersonalLedgerIncomeForMonth(data, referenceDate);
  }

  if (payrollEstimate && payrollEstimate > 0 && hasPlaidIncome) {
    return payrollEstimate;
  }

  if (!hasPlaidIncome) {
    return recurring;
  }

  const currentMonthLedger = getPersonalLedgerIncomeForMonth(data, referenceDate);
  const averageLedger = getAveragePersonalLedgerIncome(data, referenceDate);
  const referenceIncome = averageLedger > 0 ? averageLedger : currentMonthLedger;

  if (referenceIncome <= 0) {
    return recurring;
  }

  const drift = Math.abs(referenceIncome - recurring) / Math.max(referenceIncome, 1);

  if (drift > 0.2 && referenceIncome < recurring) {
    return referenceIncome;
  }

  return recurring;
}

export function calculateAnnualIncome(
  data: FinanceData,
  referenceDate = new Date(),
): number {
  return calculateMonthlyIncome(data, referenceDate) * 12;
}

export function getIncomeCalculationMode(
  data: FinanceData,
  referenceDate = new Date(),
): "recurring" | "ledger_average" | "ledger_current" | "plaid_corrected" | "payroll_detected" {
  const recurring = calculateRecurringMonthlyIncome(data);
  const recurringSources = getEffectiveIncomeSources(data).filter(isIncomeSourceActive);
  const payrollEstimate = estimateMonthlyIncomeFromPayrollDeposits(
    data,
    referenceDate,
  );

  if (recurringSources.length === 0) {
    if (payrollEstimate && payrollEstimate > 0) {
      return "payroll_detected";
    }

    const averageLedger = getAveragePersonalLedgerIncome(data, referenceDate);
    if (averageLedger > 0) {
      return "ledger_average";
    }

    return "ledger_current";
  }

  if (payrollEstimate && payrollEstimate > 0 && hasPlaidIncomeHistory(data)) {
    return "payroll_detected";
  }

  if (!hasPlaidIncomeHistory(data)) {
    return "recurring";
  }

  const referenceIncome =
    getAveragePersonalLedgerIncome(data, referenceDate) ||
    getPersonalLedgerIncomeForMonth(data, referenceDate);

  if (
    referenceIncome > 0 &&
    referenceIncome < recurring &&
    Math.abs(referenceIncome - recurring) / Math.max(referenceIncome, 1) > 0.2
  ) {
    return "plaid_corrected";
  }

  return "recurring";
}

export function getCurrentMonthLedgerIncomeTotal(
  data: FinanceData,
  referenceDate = new Date(),
): number {
  return getPersonalLedgerIncomeForMonth(data, referenceDate);
}

export function getPersonalIncomeRows(data: FinanceData) {
  return filterPersonalIncomeSources(data.income ?? [], data.viewerUserId ?? null);
}
