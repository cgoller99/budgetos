import { calculateAvailableCash } from "@/lib/calculations/availableCash";
import { getBillProgressList } from "@/lib/finance/bills";
import {
  getEffectiveIncomeSources,
  isIncomeSourceActive,
} from "@/lib/finance/effectiveIncome";
import type { FinanceData } from "@/lib/finance/types";
import { resolveUpcomingPayDate } from "@/lib/incomePlan/payDates";
import {
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

/**
 * Cash left until the next known payday after bills that are due by then.
 * Uses available cash and scheduled, active goal contributions only.
 * It does not assume a goal will be finished on a fixed timeline, and it
 * does not project investment returns.
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

  const scheduledGoalSavings = roundCurrency(
    (data.savingsGoals ?? []).reduce((total, goal) => {
      const contribution = goal.autoContribution;
      if (
        !contribution ||
        contribution.schedule.status !== "active" ||
        goal.current >= goal.target ||
        contribution.amount <= 0
      ) {
        return total;
      }

      const next = parseDateString(contribution.schedule.nextOccurrence);
      if (startOfDay(next).getTime() > horizon.getTime()) {
        return total;
      }

      return total + contribution.amount;
    }, 0),
  );

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
