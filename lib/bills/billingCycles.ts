import { getCurrentYearMonth, getDueDateForMonth, startOfDay } from "@/lib/finance/bills";
import type { Bill } from "@/lib/finance/types";
import {
  advanceOccurrence,
  parseDateString,
  toDateString,
} from "@/lib/recurring/schedule";

const MS_PER_DAY = 86_400_000;

export const PAYMENT_WINDOW_DAYS_BEFORE = 14;
export const PAYMENT_WINDOW_DAYS_AFTER = 21;

export type BillingCycle = {
  cycleMonth: string;
  dueDate: Date;
  windowStart: Date;
  windowEnd: Date;
};

export function getYearMonthFromDate(date: Date): string {
  return getCurrentYearMonth(date);
}

export function getCycleForDueDate(dueDate: Date): BillingCycle {
  const due = startOfDay(dueDate);
  const windowStart = new Date(due);
  windowStart.setDate(windowStart.getDate() - PAYMENT_WINDOW_DAYS_BEFORE);
  const windowEnd = new Date(due);
  windowEnd.setDate(windowEnd.getDate() + PAYMENT_WINDOW_DAYS_AFTER);

  return {
    cycleMonth: getYearMonthFromDate(due),
    dueDate: due,
    windowStart: startOfDay(windowStart),
    windowEnd: startOfDay(windowEnd),
  };
}

export function isDateInCycleWindow(
  dateValue: string,
  cycle: BillingCycle,
): boolean {
  const date = startOfDay(parseDateString(dateValue));
  return (
    date.getTime() >= cycle.windowStart.getTime() &&
    date.getTime() <= cycle.windowEnd.getTime()
  );
}

export function buildMonthlyCyclesForBill(
  bill: Bill,
  referenceDate = new Date(),
  lookbackMonths = 24,
): BillingCycle[] {
  const today = startOfDay(referenceDate);
  const cycles: BillingCycle[] = [];
  const seen = new Set<string>();

  if (bill.schedule?.status === "active") {
    let occurrence = startOfDay(parseDateString(bill.schedule.startDate));
    let guard = 0;

    while (occurrence.getTime() <= today.getTime() && guard < 500) {
      const cycle = getCycleForDueDate(occurrence);
      if (!seen.has(cycle.cycleMonth)) {
        cycles.push(cycle);
        seen.add(cycle.cycleMonth);
      }
      occurrence = advanceOccurrence(occurrence, bill.schedule.frequency);
      guard += 1;
    }
  }

  const dueDay = bill.dueDay > 0 ? bill.dueDay : 1;

  for (let offset = lookbackMonths; offset >= 0; offset -= 1) {
    const monthDate = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth() - offset,
      1,
    );
    const dueDate = getDueDateForMonth(dueDay, monthDate);

    if (!dueDate || dueDate.getTime() > today.getTime()) {
      continue;
    }

    const cycle = getCycleForDueDate(dueDate);
    if (!seen.has(cycle.cycleMonth)) {
      cycles.push(cycle);
      seen.add(cycle.cycleMonth);
    }
  }

  return cycles.sort(
    (left, right) => left.dueDate.getTime() - right.dueDate.getTime(),
  );
}

export function getCurrentBillingCycle(
  bill: Bill,
  referenceDate = new Date(),
): BillingCycle | null {
  const dueDay = bill.dueDay > 0 ? bill.dueDay : 1;
  const dueDate = getDueDateForMonth(dueDay, referenceDate);

  if (!dueDate) {
    return null;
  }

  return getCycleForDueDate(dueDate);
}

export function cycleIsPaidFromSchedule(
  bill: Bill,
  cycle: BillingCycle,
): boolean {
  if (!bill.schedule?.lastProcessedDate) {
    return false;
  }

  const lastProcessed = startOfDay(parseDateString(bill.schedule.lastProcessedDate));
  return lastProcessed.getTime() >= cycle.dueDate.getTime();
}

export function markSchedulePaidForCycle(
  bill: Bill,
  cycle: BillingCycle,
): Bill {
  if (!bill.schedule) {
    return bill;
  }

  const nextOccurrence = advanceOccurrence(cycle.dueDate, bill.schedule.frequency);

  return {
    ...bill,
    paidMonth: cycle.cycleMonth,
    schedule: {
      ...bill.schedule,
      lastProcessedDate: toDateString(cycle.dueDate),
      nextOccurrence: toDateString(nextOccurrence),
    },
  };
}

export function daysBetweenDates(left: Date, right: Date): number {
  return Math.round(
    Math.abs(startOfDay(left).getTime() - startOfDay(right).getTime()) /
      MS_PER_DAY,
  );
}
