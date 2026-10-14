import { calculateAvailableCash } from "@/lib/calculations/availableCash";
import { getBillProgressList } from "@/lib/finance/bills";
import {
  getEffectiveIncomeSources,
  isIncomeSourceActive,
} from "@/lib/finance/effectiveIncome";
import type { FinanceData } from "@/lib/finance/types";
import { resolveAllocationAmounts } from "@/lib/incomePlan/allocations";
import { advancePayDate, resolveUpcomingPayDate } from "@/lib/incomePlan/payDates";
import { filterPersonalIncomePlan } from "@/lib/finance/personalIncomeScope";
import {
  advanceOccurrence,
  computeInitialNextOccurrence,
  parseDateString,
  startOfDay,
  toDateString,
} from "@/lib/recurring/schedule";

const DEFAULT_HORIZON_DAYS = 14;

export type PaydayCashForecast = {
  nextPayDate: string | null;
  daysUntilPayday: number | null;
  horizonDate: string;
  availableCash: number;
  billsDueBeforePayday: number;
  scheduledGoalSavings: number;
  safeUntilPayday: number;
};

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function addDays(date: Date, days: number): Date {
  const next = startOfDay(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(start: Date, end: Date): number {
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86_400_000);
}

function nextPayday(data: FinanceData, referenceDate: Date): Date | null {
  const dates: Date[] = [];
  const plan = data.incomePlan;

  if (plan?.isActive && plan.nextPayDate) {
    dates.push(parseDateString(resolveUpcomingPayDate(plan, referenceDate)));
  }

  for (const source of getEffectiveIncomeSources(data)) {
    if (!isIncomeSourceActive(source) || !source.schedule?.nextOccurrence) {
      continue;
    }
    if (plan?.isActive && source.id === "__buxme_income_plan__") {
      continue;
    }
    dates.push(
      computeInitialNextOccurrence(
        parseDateString(source.schedule.nextOccurrence),
        source.schedule.frequency || source.frequency,
        referenceDate,
      ),
    );
  }

  if (dates.length === 0) {
    return null;
  }

  return dates.sort((left, right) => left.getTime() - right.getTime())[0];
}

function scheduledGoalContributionsUntil(
  data: FinanceData,
  today: Date,
  horizon: Date,
): { amount: number; goalIds: Set<string> } {
  const goalIds = new Set<string>();
  let amount = 0;

  for (const goal of data.savingsGoals ?? []) {
    const contribution = goal.autoContribution;
    if (
      !contribution ||
      contribution.schedule.status !== "active" ||
      goal.current >= goal.target ||
      contribution.amount <= 0
    ) {
      continue;
    }

    let cursor = parseDateString(contribution.schedule.nextOccurrence.slice(0, 10));
    if (contribution.schedule.lastProcessedDate) {
      const processed = contribution.schedule.lastProcessedDate.slice(0, 10);
      while (toDateString(cursor) <= processed) {
        cursor = advanceOccurrence(cursor, contribution.frequency);
      }
    }

    let guard = 0;
    while (cursor.getTime() <= horizon.getTime() && guard < 24) {
      if (cursor.getTime() >= today.getTime()) {
        amount += contribution.amount;
        goalIds.add(goal.id);
      }
      cursor = advanceOccurrence(cursor, contribution.frequency);
      guard += 1;
    }
  }

  return { amount: roundCurrency(amount), goalIds };
}

function incomePlanGoalAllocationsUntil(
  data: FinanceData,
  today: Date,
  horizon: Date,
  scheduledGoalIds: Set<string>,
): number {
  const plan = filterPersonalIncomePlan(data.incomePlan, data.viewerUserId ?? null);
  if (!plan?.isActive) {
    return 0;
  }

  const resolved = resolveAllocationAmounts(plan);
  const goalAllocations = resolved.filter(
    (item) =>
      item.amount > 0 &&
      item.allocation.goalId &&
      !item.allocation.isRemainingBalance &&
      !scheduledGoalIds.has(item.allocation.goalId),
  );
  if (goalAllocations.length === 0) {
    return 0;
  }

  let cursor = parseDateString(resolveUpcomingPayDate(plan, today));
  let total = 0;
  let guard = 0;
  while (cursor.getTime() <= horizon.getTime() && guard < 24) {
    if (cursor.getTime() >= today.getTime()) {
      for (const item of goalAllocations) {
        total += item.amount;
      }
    }
    cursor = parseDateString(
      advancePayDate({ ...plan, nextPayDate: toDateString(cursor) }),
    );
    guard += 1;
  }

  return roundCurrency(total);
}

/**
 * Cash left until the next known payday after bills that are due by then.
 * Counts every scheduled goal contribution occurrence in the window and
 * Income Plan goal allocations that are not already covered by a schedule.
 * Planned contributions reduce projected spendable cash only — they do not
 * increase actual saved balances.
 */
export function forecastCashUntilPayday(
  data: FinanceData,
  referenceDate = new Date(),
): PaydayCashForecast {
  const today = startOfDay(referenceDate);
  const payday = nextPayday(data, referenceDate);
  const horizon = payday ?? addDays(today, DEFAULT_HORIZON_DAYS);

  const billsDueBeforePayday = roundCurrency(
    getBillProgressList(data, referenceDate)
      .filter((bill) => {
        if (bill.status === "paid" || !bill.dueDate) {
          return false;
        }
        return startOfDay(bill.dueDate).getTime() <= horizon.getTime();
      })
      .reduce((total, bill) => total + bill.remainingAmount, 0),
  );

  const scheduled = scheduledGoalContributionsUntil(data, today, horizon);
  const planGoals = incomePlanGoalAllocationsUntil(
    data,
    today,
    horizon,
    scheduled.goalIds,
  );
  const scheduledGoalSavings = roundCurrency(scheduled.amount + planGoals);

  const availableCash = roundCurrency(calculateAvailableCash(data));

  return {
    nextPayDate: payday ? toDateString(payday) : null,
    daysUntilPayday: payday ? daysBetween(today, payday) : null,
    horizonDate: toDateString(horizon),
    availableCash,
    billsDueBeforePayday,
    scheduledGoalSavings,
    safeUntilPayday: roundCurrency(
      availableCash - billsDueBeforePayday - scheduledGoalSavings,
    ),
  };
}
