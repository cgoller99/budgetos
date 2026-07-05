import type { IncomePlan, IncomePlanSchedule } from "@/lib/incomePlan/types";
import { WEEKDAY_LABELS } from "@/lib/incomePlan/types";
import {
  parseDateString,
  startOfDay,
  toDateString,
} from "@/lib/recurring/schedule";

function clampDayOfMonth(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(Math.max(day, 1), lastDay));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function nextWeeklyDate(
  anchor: Date,
  weekday: number,
  referenceDate: Date,
): Date {
  const today = startOfDay(referenceDate);
  let candidate = startOfDay(anchor);

  while (candidate.getDay() !== weekday) {
    candidate = addDays(candidate, 1);
  }

  while (candidate.getTime() < today.getTime()) {
    candidate = addDays(candidate, 7);
  }

  return candidate;
}

function nextBiweeklyDate(anchor: Date, referenceDate: Date): Date {
  const today = startOfDay(referenceDate);
  let candidate = startOfDay(anchor);

  while (candidate.getTime() < today.getTime()) {
    candidate = addDays(candidate, 14);
  }

  return candidate;
}

function nextMonthlyDayDate(
  days: number[],
  referenceDate: Date,
): Date {
  const today = startOfDay(referenceDate);
  const sortedDays = [...days].sort((left, right) => left - right);

  for (let monthOffset = 0; monthOffset < 24; monthOffset += 1) {
    const base = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);

    for (const day of sortedDays) {
      const candidate = clampDayOfMonth(
        base.getFullYear(),
        base.getMonth(),
        day,
      );

      if (candidate.getTime() >= today.getTime()) {
        return candidate;
      }
    }
  }

  return today;
}

function nextCustomIntervalDate(
  anchor: Date,
  intervalDays: number,
  referenceDate: Date,
): Date {
  const today = startOfDay(referenceDate);
  let candidate = startOfDay(anchor);
  const interval = Math.max(intervalDays, 1);

  while (candidate.getTime() < today.getTime()) {
    candidate = addDays(candidate, interval);
  }

  return candidate;
}

export function computeNextPayDate(
  schedule: IncomePlanSchedule,
  anchorDate: string,
  referenceDate = new Date(),
  options?: {
    weeklyDayOfWeek?: number | null;
    monthlyDays?: number[];
    customIntervalDays?: number | null;
  },
): string {
  const anchor = parseDateString(anchorDate);
  const weekday = options?.weeklyDayOfWeek ?? anchor.getDay();
  const monthlyDays = options?.monthlyDays ?? [1, 15];
  const customIntervalDays = options?.customIntervalDays ?? 14;

  let next: Date;

  switch (schedule) {
    case "weekly":
      next = nextWeeklyDate(anchor, weekday, referenceDate);
      break;
    case "biweekly":
      next = nextBiweeklyDate(anchor, referenceDate);
      break;
    case "twice_monthly":
      next = nextMonthlyDayDate(monthlyDays, referenceDate);
      break;
    case "monthly":
      next = nextMonthlyDayDate(
        monthlyDays.length > 0 ? [monthlyDays[0]] : [1],
        referenceDate,
      );
      break;
    case "quarterly":
      next = nextCustomIntervalDate(anchor, 91, referenceDate);
      break;
    case "yearly":
      next = nextCustomIntervalDate(anchor, 365, referenceDate);
      break;
    case "custom":
      next = nextCustomIntervalDate(
        anchor,
        customIntervalDays,
        referenceDate,
      );
      break;
    default:
      next = nextBiweeklyDate(anchor, referenceDate);
  }

  return toDateString(next);
}

export function advancePayDate(
  plan: Pick<
    IncomePlan,
    | "paySchedule"
    | "anchorDate"
    | "weeklyDayOfWeek"
    | "monthlyDays"
    | "customIntervalDays"
    | "nextPayDate"
  >,
): string {
  const current = parseDateString(plan.nextPayDate);
  const dayAfter = new Date(current);
  dayAfter.setDate(dayAfter.getDate() + 1);

  return computeNextPayDate(
    plan.paySchedule,
    plan.anchorDate,
    dayAfter,
    {
      weeklyDayOfWeek: plan.weeklyDayOfWeek,
      monthlyDays: plan.monthlyDays,
      customIntervalDays: plan.customIntervalDays,
    },
  );
}

export function getPayDatesInMonth(
  plan: Pick<
    IncomePlan,
    | "paySchedule"
    | "anchorDate"
    | "weeklyDayOfWeek"
    | "monthlyDays"
    | "customIntervalDays"
    | "nextPayDate"
  >,
  year: number,
  month: number,
): string[] {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const dates: string[] = [];

  if (plan.paySchedule === "twice_monthly" || plan.paySchedule === "monthly") {
    const days =
      plan.paySchedule === "monthly"
        ? [plan.monthlyDays[0] ?? 1]
        : plan.monthlyDays;

    for (const day of days) {
      const candidate = clampDayOfMonth(year, month, day);
      dates.push(toDateString(candidate));
    }

    return dates.sort();
  }

  let cursor = parseDateString(plan.anchorDate);

  if (plan.paySchedule === "weekly") {
    const weekday = plan.weeklyDayOfWeek ?? cursor.getDay();
    while (cursor.getDay() !== weekday) {
      cursor = addDays(cursor, 1);
    }
  }

  let guard = 0;

  while (cursor.getTime() <= monthEnd.getTime() && guard < 10) {
    if (cursor.getTime() >= monthStart.getTime()) {
      dates.push(toDateString(cursor));
    }

    switch (plan.paySchedule) {
      case "weekly":
        cursor = addDays(cursor, 7);
        break;
      case "biweekly":
      case "custom":
      case "quarterly":
      case "yearly":
        cursor = addDays(
          cursor,
          plan.paySchedule === "custom"
            ? Math.max(plan.customIntervalDays ?? 14, 1)
            : plan.paySchedule === "quarterly"
              ? 91
              : plan.paySchedule === "yearly"
                ? 365
                : 14,
        );
        break;
      default:
        guard = 10;
        break;
    }

    guard += 1;
  }

  return dates;
}

export function isExtraPaycheckMonth(
  plan: Pick<
    IncomePlan,
    | "paySchedule"
    | "anchorDate"
    | "weeklyDayOfWeek"
    | "monthlyDays"
    | "customIntervalDays"
    | "nextPayDate"
  >,
  referenceDate = new Date(),
): boolean {
  if (plan.paySchedule !== "biweekly") {
    return false;
  }

  const dates = getPayDatesInMonth(
    plan,
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
  );

  return dates.length >= 3;
}

export function getPaycheckIndexInMonth(
  plan: Pick<
    IncomePlan,
    | "paySchedule"
    | "anchorDate"
    | "weeklyDayOfWeek"
    | "monthlyDays"
    | "customIntervalDays"
    | "nextPayDate"
  >,
  payDate: string,
): number {
  const date = parseDateString(payDate);
  const dates = getPayDatesInMonth(
    plan,
    date.getFullYear(),
    date.getMonth(),
  );

  return dates.indexOf(payDate) + 1;
}

export function formatPayDate(dateString: string): string {
  const date = parseDateString(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function daysUntilPayDate(
  payDate: string,
  referenceDate = new Date(),
): number {
  const today = startOfDay(referenceDate);
  const target = startOfDay(parseDateString(payDate));
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function describePaySchedule(plan: IncomePlan): string {
  const weekday =
    plan.weeklyDayOfWeek !== null
      ? WEEKDAY_LABELS[plan.weeklyDayOfWeek]
      : WEEKDAY_LABELS[parseDateString(plan.anchorDate).getDay()];

  switch (plan.paySchedule) {
    case "weekly":
      return `Every ${weekday}`;
    case "biweekly":
      return `Every other ${weekday}`;
    case "twice_monthly": {
      const days = plan.monthlyDays.map((day) => {
        if (day === 1) return "1st";
        if (day === 15) return "15th";
        if (day === 31) return "last day";
        return `${day}th`;
      });
      return days.join(" & ");
    }
    case "monthly": {
      const day = plan.monthlyDays[0] ?? 1;
      if (day === 1) return "1st of each month";
      return `${day}th of each month`;
    }
    case "quarterly":
      return "Every 3 months";
    case "yearly":
      return "Once a year";
    case "custom":
      return `Every ${plan.customIntervalDays ?? 14} days`;
    default:
      return "Custom";
  }
}
