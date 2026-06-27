import { calculateEmergencyFundMonths } from "@/lib/calculations/financialHealth";
import { calculateNetWorth } from "@/lib/calculations/netWorth";
import { getBillsDueThisWeek } from "@/lib/finance/bills";
import { formatCurrency } from "@/lib/finance/format";
import { getNextGoal } from "@/lib/finance/goals";
import { calculateMoneyFlow } from "@/lib/finance/moneyFlow";
import type { Debt, FinanceData, IncomeFrequency } from "@/lib/finance/types";

const WEEKS_PER_MONTH = 4.33;
const GOAL_TARGET_MONTHS = 12;
const EMERGENCY_FUND_TARGET_MONTHS = 6;

export function getPrimaryIncomeFrequency(data: FinanceData): IncomeFrequency {
  return (data.income ?? [])[0]?.frequency ?? "biweekly";
}

export function getPayPeriodDays(frequency: IncomeFrequency): number {
  switch (frequency) {
    case "weekly":
      return 7;
    case "biweekly":
    case "every_2_weeks":
      return 14;
    case "twice_monthly":
      return 15;
    case "monthly":
      return 30;
    case "yearly":
      return 365;
    default:
      return 14;
  }
}

export function calculateDaysUntilNextPaycheck(
  data: FinanceData,
  referenceDate = new Date(),
): number {
  const frequency = getPrimaryIncomeFrequency(data);
  const payPeriodDays = getPayPeriodDays(frequency);

  if (frequency === "monthly") {
    const lastDay = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth() + 1,
      0,
    ).getDate();
    const daysRemaining = lastDay - referenceDate.getDate();
    return Math.max(daysRemaining, 1);
  }

  if (frequency === "weekly") {
    const dayOfWeek = referenceDate.getDay();
    return Math.max(7 - dayOfWeek, 1);
  }

  if (frequency === "twice_monthly") {
    const day = referenceDate.getDate();
    if (day < 15) {
      return Math.max(15 - day, 1);
    }

    const lastDay = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth() + 1,
      0,
    ).getDate();
    return Math.max(lastDay - day + 1, 1);
  }

  return Math.max(Math.round(payPeriodDays / 2), 1);
}

export function calculateSafeToSpendBeforePaycheck(
  data: FinanceData,
  referenceDate = new Date(),
): number {
  const moneyFlow = calculateMoneyFlow(data);
  const daysUntilPaycheck = calculateDaysUntilNextPaycheck(data, referenceDate);
  const payPeriodDays = getPayPeriodDays(getPrimaryIncomeFrequency(data));

  if (moneyFlow.income <= 0) {
    return 0;
  }

  return Math.round(
    moneyFlow.safeToSpend * (daysUntilPaycheck / payPeriodDays),
  );
}

export function calculateBillsDueThisWeekTotal(
  data: FinanceData,
  referenceDate = new Date(),
): number {
  return getBillsDueThisWeek(data, referenceDate).reduce(
    (total, bill) => total + bill.amount,
    0,
  );
}

export function calculateNetWorthMonthlyChange(data: FinanceData): number {
  return calculateNetWorth(data).monthlyChange;
}

export function getHighestInterestDebt(data: FinanceData): Debt | null {
  const debts = data.debts ?? [];

  if (debts.length === 0) {
    return null;
  }

  return [...debts].sort(
    (left, right) => right.interestRate - left.interestRate,
  )[0];
}

export function estimatePayoffMonths(
  balance: number,
  monthlyPayment: number,
): number {
  if (balance <= 0) {
    return 0;
  }

  if (monthlyPayment <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.ceil(balance / monthlyPayment);
}

export function estimateExtraDebtPayoffSavings(
  debt: Debt,
  extraPayment: number,
): { extraPayment: number; monthsSaved: number } {
  const normalizedExtra = Math.max(25, Math.round(extraPayment / 25) * 25);
  const currentMonths = estimatePayoffMonths(debt.balance, debt.minimumPayment);
  const acceleratedMonths = estimatePayoffMonths(
    debt.balance,
    debt.minimumPayment + normalizedExtra,
  );

  if (!Number.isFinite(currentMonths) || !Number.isFinite(acceleratedMonths)) {
    return { extraPayment: normalizedExtra, monthsSaved: 0 };
  }

  return {
    extraPayment: normalizedExtra,
    monthsSaved: Math.max(0, currentMonths - acceleratedMonths),
  };
}

export function suggestExtraDebtPayment(data: FinanceData): {
  debt: Debt;
  extraPayment: number;
  monthsSaved: number;
} | null {
  const debt = getHighestInterestDebt(data);

  if (!debt || debt.balance <= 0) {
    return null;
  }

  const suggestedExtra = Math.min(
    Math.max(25, Math.round(debt.minimumPayment * 0.25 / 25) * 25),
    Math.round(debt.balance * 0.1 / 25) * 25,
  );

  const { extraPayment, monthsSaved } = estimateExtraDebtPayoffSavings(
    debt,
    suggestedExtra,
  );

  if (monthsSaved <= 0) {
    return null;
  }

  return { debt, extraPayment, monthsSaved };
}

export function suggestGoalWeeklyBoost(
  data: FinanceData,
): { goalName: string; weeklyAmount: number } | null {
  const nextGoal = getNextGoal(data);
  const moneyFlow = calculateMoneyFlow(data);

  if (!nextGoal || nextGoal.isComplete) {
    return null;
  }

  const activeGoals = (data.savingsGoals ?? []).filter(
    (goal) => goal.current < goal.target,
  );
  const monthlyNeed = nextGoal.remaining / GOAL_TARGET_MONTHS;
  const allocatedMonthly =
    activeGoals.length > 0
      ? moneyFlow.goals / activeGoals.length
      : moneyFlow.goals;
  const monthlyGap = monthlyNeed - allocatedMonthly;

  if (monthlyGap <= 0) {
    return null;
  }

  const weeklyAmount = Math.ceil((monthlyGap / WEEKS_PER_MONTH) / 25) * 25;

  if (weeklyAmount <= 0) {
    return null;
  }

  return {
    goalName: nextGoal.name,
    weeklyAmount,
  };
}

export function getEmergencyFundStatus(data: FinanceData): {
  monthsCovered: number;
  belowTarget: boolean;
  severity: "critical" | "attention" | "healthy";
} {
  const monthsCovered = calculateEmergencyFundMonths(data);

  if (monthsCovered >= EMERGENCY_FUND_TARGET_MONTHS) {
    return { monthsCovered, belowTarget: false, severity: "healthy" };
  }

  if (monthsCovered < 1) {
    return { monthsCovered, belowTarget: true, severity: "critical" };
  }

  return { monthsCovered, belowTarget: true, severity: "attention" };
}

export function formatPaycheckLabel(data: FinanceData): string {
  const frequency = getPrimaryIncomeFrequency(data);

  switch (frequency) {
    case "weekly":
    case "biweekly":
    case "every_2_weeks":
      return "next paycheck";
    case "twice_monthly":
      return "next payday";
    case "monthly":
      return "end of the month";
    case "yearly":
      return "next annual payout";
    default:
      return "next paycheck";
  }
}

export { formatCurrency, EMERGENCY_FUND_TARGET_MONTHS };
