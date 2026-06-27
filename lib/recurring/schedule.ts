import type { RecurringSchedule } from "@/lib/recurring/types";

const MS_PER_DAY = 86_400_000;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateString(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function isSameDay(left: Date, right: Date): boolean {
  return startOfDay(left).getTime() === startOfDay(right).getTime();
}

export function isActivityDue(
  schedule: RecurringSchedule,
  referenceDate = new Date(),
): boolean {
  if (schedule.status !== "active") {
    return false;
  }

  const today = startOfDay(referenceDate);
  const next = startOfDay(parseDateString(schedule.nextOccurrence));

  if (next.getTime() > today.getTime()) {
    return false;
  }

  if (schedule.lastProcessedDate) {
    const lastProcessed = startOfDay(parseDateString(schedule.lastProcessedDate));

    if (isSameDay(lastProcessed, today)) {
      return false;
    }
  }

  return true;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return startOfDay(next);
}

function getTwiceMonthlyNext(from: Date): Date {
  const day = from.getDate();

  if (day < 15) {
    return new Date(from.getFullYear(), from.getMonth(), 15);
  }

  return new Date(from.getFullYear(), from.getMonth() + 1, 1);
}

export function advanceOccurrence(
  fromDate: Date,
  frequency: string,
): Date {
  const from = startOfDay(fromDate);

  switch (frequency) {
    case "weekly":
      return addDays(from, 7);
    case "biweekly":
    case "every_2_weeks":
      return addDays(from, 14);
    case "twice_monthly":
      return getTwiceMonthlyNext(from);
    case "monthly":
      return addMonths(from, 1);
    case "quarterly":
      return addMonths(from, 3);
    case "yearly":
      return addMonths(from, 12);
    default:
      return addMonths(from, 1);
  }
}

export function computeInitialNextOccurrence(
  startDate: Date,
  frequency: string,
  referenceDate = new Date(),
): Date {
  let next = startOfDay(startDate);
  const today = startOfDay(referenceDate);

  if (next.getTime() > today.getTime()) {
    return next;
  }

  let guard = 0;

  while (next.getTime() < today.getTime() && guard < 500) {
    next = advanceOccurrence(next, frequency);
    guard += 1;
  }

  return next;
}

export function markScheduleProcessed(
  schedule: RecurringSchedule,
  referenceDate = new Date(),
): RecurringSchedule {
  const today = toDateString(referenceDate);
  const next = advanceOccurrence(referenceDate, schedule.frequency);

  return {
    ...schedule,
    lastProcessedDate: today,
    nextOccurrence: toDateString(next),
  };
}

export function createSchedule(
  startDate: Date,
  frequency: string,
  referenceDate = new Date(),
  status: RecurringSchedule["status"] = "active",
): RecurringSchedule {
  return {
    startDate: toDateString(startDate),
    frequency,
    nextOccurrence: toDateString(
      computeInitialNextOccurrence(startDate, frequency, referenceDate),
    ),
    lastProcessedDate: null,
    status,
  };
}

export function daysUntil(date: Date, referenceDate: Date): number {
  const today = startOfDay(referenceDate);
  const target = startOfDay(date);
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
}
