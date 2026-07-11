import type { FinanceData, Transaction } from "@/lib/finance/types";
import { toMonthlyAmount } from "@/lib/calculations/monthlyAmount";
import { filterPersonalIncomePlan } from "@/lib/finance/personalIncomeScope";
import { filterRealIncomeTransactions } from "@/lib/transactions/transferDetection";
import type { IncomePlanSchedule } from "@/lib/incomePlan/types";

const PAYROLL_MERCHANT_PATTERNS = [
  /\bquickbooks\b/i,
  /\bpayroll\b/i,
  /\bdirect dep\b/i,
  /\bdir dep\b/i,
  /\bpaycheck\b/i,
  /\bsalary\b/i,
  /\bwages\b/i,
  /\bemployer\b/i,
];

const NON_PAYROLL_INCOME_PATTERNS = [
  /\bstate farm\b/i,
  /\brefund\b/i,
  /\breversal\b/i,
  /\breturn\b/i,
  /\breimbursement\b/i,
  /\bcashout\b/i,
  /\bvenmo\b/i,
  /\bzelle\b/i,
  /\bcash app\b/i,
  /\bpaypal\b/i,
  /\btax refund\b/i,
  /\birs\b/i,
];

function transactionLabel(transaction: Transaction): string {
  return `${transaction.notes ?? ""} ${transaction.category ?? ""}`.trim();
}

function isPayrollLikeDeposit(transaction: Transaction): boolean {
  const label = transactionLabel(transaction);

  if (NON_PAYROLL_INCOME_PATTERNS.some((pattern) => pattern.test(label))) {
    return false;
  }

  return PAYROLL_MERCHANT_PATTERNS.some((pattern) => pattern.test(label));
}

function mapPayScheduleToFrequency(schedule: IncomePlanSchedule): string {
  switch (schedule) {
    case "weekly":
      return "weekly";
    case "biweekly":
      return "every_2_weeks";
    case "twice_monthly":
      return "twice_monthly";
    case "monthly":
      return "monthly";
    case "quarterly":
      return "quarterly";
    case "yearly":
      return "yearly";
    default:
      return "every_2_weeks";
  }
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1]! + sorted[middle]!) / 2;
  }

  return sorted[middle]!;
}

function getRecentIncomeDeposits(
  data: FinanceData,
  referenceDate: Date,
  lookbackDays = 120,
): Transaction[] {
  const cutoff = new Date(referenceDate);
  cutoff.setDate(cutoff.getDate() - lookbackDays);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  return filterRealIncomeTransactions(
    data,
    (data.transactions ?? []).filter(
      (transaction) =>
        transaction.type === "income" &&
        transaction.amount > 0 &&
        transaction.date >= cutoffIso,
    ),
  );
}

function selectPaycheckAmounts(deposits: Transaction[]): number[] {
  const payrollDeposits = deposits.filter(isPayrollLikeDeposit);

  if (payrollDeposits.length >= 2) {
    const amounts = payrollDeposits.map((deposit) => deposit.amount);
    const seedMedian = median(amounts);
    const minimum = seedMedian * 0.5;

    return amounts.filter((amount) => amount >= minimum);
  }

  if (deposits.length < 2) {
    return [];
  }

  const amounts = deposits.map((deposit) => deposit.amount);
  const seedMedian = median(amounts);
  const minimum = seedMedian * 0.5;

  return amounts.filter((amount) => amount >= minimum);
}

export function estimateMonthlyIncomeFromPayrollDeposits(
  data: FinanceData,
  referenceDate = new Date(),
): number | null {
  const viewerUserId = data.viewerUserId ?? null;
  const personalPlan = filterPersonalIncomePlan(data.incomePlan, viewerUserId);
  const deposits = getRecentIncomeDeposits(data, referenceDate);

  if (deposits.length < 2) {
    return null;
  }

  const paycheckAmounts = selectPaycheckAmounts(deposits);

  if (paycheckAmounts.length < 2) {
    return null;
  }

  const typicalPaycheck = median(paycheckAmounts);
  const frequency = personalPlan
    ? mapPayScheduleToFrequency(personalPlan.paySchedule)
    : "every_2_weeks";

  return toMonthlyAmount(typicalPaycheck, frequency);
}

export function getPayrollIncomeDiagnostics(
  data: FinanceData,
  referenceDate = new Date(),
) {
  const deposits = getRecentIncomeDeposits(data, referenceDate);
  const paycheckAmounts = selectPaycheckAmounts(deposits);
  const estimate = estimateMonthlyIncomeFromPayrollDeposits(data, referenceDate);

  return {
    depositCount: deposits.length,
    paycheckSampleCount: paycheckAmounts.length,
    medianPaycheck:
      paycheckAmounts.length > 0 ? Math.round(median(paycheckAmounts) * 100) / 100 : null,
    estimatedMonthly: estimate ? Math.round(estimate * 100) / 100 : null,
    sampleDeposits: deposits
      .filter((deposit) => paycheckAmounts.includes(deposit.amount))
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, 6)
      .map((deposit) => ({
        date: deposit.date,
        amount: deposit.amount,
        label: transactionLabel(deposit).slice(0, 60),
        payrollLike: isPayrollLikeDeposit(deposit),
      })),
  };
}
