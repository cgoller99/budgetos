import { getBillProgressList } from "@/lib/finance/bills";
import { forecastCashUntilPayday } from "@/lib/finance/cashFlowForecast";
import { calculateAvailableCash } from "@/lib/calculations/availableCash";
import { filterPersonalIncomePlan } from "@/lib/finance/personalIncomeScope";
import { resolveAllocationAmounts } from "@/lib/incomePlan/allocations";
import type { FinanceData } from "@/lib/finance/types";
import {
  advanceOccurrence,
  parseDateString,
  startOfDay,
  toDateString,
} from "@/lib/recurring/schedule";

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Planned (not confirmed) savings goal contributions scheduled before payday.
 * Does not invent bank transfers — these are commitments on the plan.
 */
export function plannedSavingsUntilPayday(
  data: FinanceData,
  referenceDate = new Date(),
): number {
  const payday = forecastCashUntilPayday(data, referenceDate);
  if (!payday.nextPayDate) {
    return 0;
  }
  const today = startOfDay(referenceDate);
  const horizon = parseDateString(payday.nextPayDate);
  let total = 0;

  for (const goal of data.savingsGoals ?? []) {
    const contribution = goal.autoContribution;
    if (
      !contribution ||
      contribution.schedule.status !== "active" ||
      contribution.amount <= 0 ||
      goal.current >= goal.target
    ) {
      continue;
    }
    let cursor = parseDateString(contribution.schedule.nextOccurrence.slice(0, 10));
    let guard = 0;
    while (cursor.getTime() <= horizon.getTime() && guard < 24) {
      if (cursor.getTime() >= today.getTime()) {
        total += contribution.amount;
      }
      cursor = advanceOccurrence(cursor, contribution.frequency);
      guard += 1;
    }
  }

  // Income Plan goal allocations for the next paycheck (once) — not doubled with autoContribution
  // when the same goalId is already counted via autoContribution above.
  const plan = filterPersonalIncomePlan(data.incomePlan, data.viewerUserId ?? null);
  if (plan?.isActive && plan.paycheckAmount > 0) {
    const countedGoalIds = new Set(
      (data.savingsGoals ?? [])
        .filter((goal) => goal.autoContribution?.schedule.status === "active")
        .map((goal) => goal.id),
    );
    const resolved = resolveAllocationAmounts({
      paycheckAmount: plan.paycheckAmount,
      allocations: plan.allocations,
    });
    for (const item of resolved) {
      const goalId = item.allocation.goalId;
      if (!goalId || countedGoalIds.has(goalId) || item.amount <= 0) {
        continue;
      }
      total += item.amount;
    }
  }

  return round(total);
}

export type MoneyLeftUntilPayday = {
  availableCash: number;
  billsDueBeforePayday: number;
  scheduledGoalSavings: number;
  plannedSavingsCommitments: number;
  safeUntilPayday: number;
  /** Cash after bills, forecast goal savings, and planned savings commitments. */
  moneyLeftAfterCommitments: number;
  nextPayDate: string | null;
  daysUntilPayday: number | null;
};

/**
 * Shared until-payday money-left contract for Home, Budgets, Income, and Goals.
 * Does not treat unused category budget allowance as spendable cash.
 */
export function calculateMoneyLeftUntilPayday(
  data: FinanceData,
  referenceDate = new Date(),
): MoneyLeftUntilPayday {
  const payday = forecastCashUntilPayday(data, referenceDate);
  const availableCash = round(calculateAvailableCash(data));
  const plannedSavingsCommitments = plannedSavingsUntilPayday(data, referenceDate);
  // forecastCashUntilPayday already subtracts bills + scheduled goal savings on autoContribution.
  // Add only Income Plan goal allocations that are not already counted.
  const moneyLeftAfterCommitments = round(
    payday.safeUntilPayday -
      Math.max(0, plannedSavingsCommitments - payday.scheduledGoalSavings),
  );

  return {
    availableCash,
    billsDueBeforePayday: payday.billsDueBeforePayday,
    scheduledGoalSavings: payday.scheduledGoalSavings,
    plannedSavingsCommitments,
    safeUntilPayday: payday.safeUntilPayday,
    moneyLeftAfterCommitments,
    nextPayDate: payday.nextPayDate,
    daysUntilPayday: payday.daysUntilPayday,
  };
}

/** Bills due before a horizon — shared helper for paycheck summaries. */
export function billsDueBeforeDate(
  data: FinanceData,
  horizon: Date,
  referenceDate = new Date(),
): number {
  return round(
    getBillProgressList(data, referenceDate)
      .filter((bill) => {
        if (bill.status === "paid" || !bill.dueDate) return false;
        return startOfDay(bill.dueDate).getTime() <= startOfDay(horizon).getTime();
      })
      .reduce((total, bill) => total + bill.remainingAmount, 0),
  );
}

export function toDateOnlyString(date: Date): string {
  return toDateString(startOfDay(date));
}
