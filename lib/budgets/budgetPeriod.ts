import { WEEKDAY_LABELS } from "@/lib/incomePlan/types";
import { parseDateString, startOfDay, toDateString } from "@/lib/recurring/schedule";

/**
 * Category budget periods.
 * Monthly is the calendar month, which is the meaning of every saved budget
 * that does not store a frequency. Other periods repeat from a stored anchor
 * so opening the page does not move the schedule to today.
 * Safe to Spend keeps the existing money-flow waterfall. This module only
 * converts a budget into one monthly equivalent for that monthly picture.
 */

export type BudgetFrequency =
  | "weekly"
  | "biweekly"
  | "twice_monthly"
  | "monthly"
  | "custom";

export type BudgetSchedule = {
  frequency: BudgetFrequency;
  anchorDate: string | null;
  weekday: number | null;
  monthDays: [number, number] | null;
  intervalDays: number | null;
};

export type BudgetPeriod = {
  start: string;
  end: string;
};

export const BUDGET_FREQUENCIES: BudgetFrequency[] = [
  "weekly",
  "biweekly",
  "twice_monthly",
  "monthly",
  "custom",
];

export const BUDGET_FREQUENCY_LABELS: Record<BudgetFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Every two weeks",
  twice_monthly: "Twice a month",
  monthly: "Monthly",
  custom: "Custom period",
};

export { WEEKDAY_LABELS };

/** Monday epoch used when a repeating budget has no stored anchor yet. */
const STABLE_EPOCH = "2024-01-01";

const FREQUENCY_SET = new Set<string>(BUDGET_FREQUENCIES);

export function roundBudgetCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function calendarDaysBetween(start: Date, end: Date): number {
  const left = startOfDay(start);
  const right = startOfDay(end);
  const utcLeft = Date.UTC(left.getFullYear(), left.getMonth(), left.getDate());
  const utcRight = Date.UTC(right.getFullYear(), right.getMonth(), right.getDate());
  return Math.round((utcRight - utcLeft) / 86_400_000);
}

function clampDayOfMonth(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(Math.max(day, 1), lastDay));
}

function readFrequency(value: unknown): BudgetFrequency {
  if (value === "semimonthly" || value === "twice_monthly") return "twice_monthly";
  if (value === "every_2_weeks") return "biweekly";
  if (typeof value === "string" && FREQUENCY_SET.has(value)) {
    return value as BudgetFrequency;
  }
  return "monthly";
}

function readDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = parseDateString(value);
  if (Number.isNaN(parsed.getTime()) || toDateString(parsed) !== value) return null;
  return value;
}

function readWeekday(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 6) return null;
  return parsed;
}

function readDayOfMonth(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 31) return null;
  return parsed;
}

function readMonthDays(value: unknown): [number, number] | null {
  let source: unknown[] | null = null;
  if (Array.isArray(value)) {
    source = value;
  } else if (typeof value === "string") {
    const trimmed = value.trim().replace(/^\{/, "").replace(/\}$/, "");
    if (!trimmed) return null;
    source = trimmed.split(",");
  }
  if (!source || source.length < 2) return null;
  const first = readDayOfMonth(source[0]);
  const second = readDayOfMonth(source[1]);
  if (first == null || second == null || first === second) return null;
  return first < second ? [first, second] : [second, first];
}

function readInterval(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 366) return null;
  return parsed;
}

function field(input: unknown, key: string): unknown {
  if (!input || typeof input !== "object") return undefined;
  return (input as Record<string, unknown>)[key];
}

export function normalizeBudgetSchedule(input: unknown): BudgetSchedule {
  const frequency = readFrequency(field(input, "frequency"));
  const anchorDate = readDate(field(input, "anchorDate") ?? field(input, "anchor_date"));
  const weekday = readWeekday(field(input, "weekday"));
  const monthDays = readMonthDays(field(input, "monthDays") ?? field(input, "month_days"));
  const intervalDays = readInterval(field(input, "intervalDays") ?? field(input, "interval_days"));

  if (frequency === "weekly") {
    return {
      frequency,
      anchorDate,
      weekday: weekday ?? (anchorDate ? parseDateString(anchorDate).getDay() : null),
      monthDays: null,
      intervalDays: null,
    };
  }

  if (frequency === "biweekly") {
    return {
      frequency,
      anchorDate,
      weekday: null,
      monthDays: null,
      intervalDays: null,
    };
  }

  if (frequency === "twice_monthly") {
    return {
      frequency,
      anchorDate: null,
      weekday: null,
      monthDays: monthDays ?? [1, 15],
      intervalDays: null,
    };
  }

  if (frequency === "custom") {
    return {
      frequency,
      anchorDate,
      weekday: null,
      monthDays: null,
      intervalDays: intervalDays ?? 14,
    };
  }

  return {
    frequency: "monthly",
    anchorDate: null,
    weekday: null,
    monthDays: null,
    intervalDays: null,
  };
}

export type StoredBudgetSchedule = {
  frequency?: BudgetFrequency;
  anchorDate?: string | null;
  weekday?: number | null;
  monthDays?: [number, number] | null;
  intervalDays?: number | null;
};

/** Fields worth persisting. Monthly rows omit them so older caches stay unchanged. */
export function storedScheduleFields(input: unknown): StoredBudgetSchedule {
  const schedule = normalizeBudgetSchedule(input);
  if (schedule.frequency === "monthly") return {};
  return {
    frequency: schedule.frequency,
    anchorDate: schedule.anchorDate,
    weekday: schedule.weekday,
    monthDays: schedule.monthDays,
    intervalDays: schedule.intervalDays,
  };
}

export function schedulesEqual(left: unknown, right: unknown): boolean {
  const a = normalizeBudgetSchedule(left);
  const b = normalizeBudgetSchedule(right);
  return (
    a.frequency === b.frequency &&
    a.anchorDate === b.anchorDate &&
    a.weekday === b.weekday &&
    a.intervalDays === b.intervalDays &&
    (a.monthDays?.[0] ?? null) === (b.monthDays?.[0] ?? null) &&
    (a.monthDays?.[1] ?? null) === (b.monthDays?.[1] ?? null)
  );
}

/**
 * Apply one user edit. A missing anchor is chosen once, from the reference
 * date passed by that edit, and then stored. Later reads keep that anchor.
 */
export function scheduleForEdit(
  current: unknown,
  patch: Partial<BudgetSchedule>,
  referenceDate = new Date(),
): BudgetSchedule {
  const base = normalizeBudgetSchedule(current);
  let schedule = normalizeBudgetSchedule({
    frequency: patch.frequency ?? base.frequency,
    anchorDate: patch.anchorDate !== undefined ? patch.anchorDate : base.anchorDate,
    weekday: patch.weekday !== undefined ? patch.weekday : base.weekday,
    monthDays: patch.monthDays !== undefined ? patch.monthDays : base.monthDays,
    intervalDays: patch.intervalDays !== undefined ? patch.intervalDays : base.intervalDays,
  });

  if (
    schedule.frequency !== "weekly" &&
    schedule.frequency !== "biweekly" &&
    schedule.frequency !== "custom"
  ) {
    return schedule;
  }

  if (!schedule.anchorDate) {
    const today = startOfDay(referenceDate);
    if (schedule.frequency === "weekly") {
      const weekday = schedule.weekday ?? today.getDay();
      const delta = (today.getDay() - weekday + 7) % 7;
      return {
        ...schedule,
        weekday,
        anchorDate: toDateString(addDays(today, -delta)),
      };
    }
    return { ...schedule, anchorDate: toDateString(today) };
  }

  if (schedule.frequency === "weekly") {
    const weekday = schedule.weekday ?? parseDateString(schedule.anchorDate).getDay();
    const anchor = parseDateString(schedule.anchorDate);
    const delta = (anchor.getDay() - weekday + 7) % 7;
    return {
      ...schedule,
      weekday,
      anchorDate: toDateString(addDays(anchor, -delta)),
    };
  }

  return schedule;
}

function calendarMonth(today: Date): BudgetPeriod {
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { start: toDateString(start), end: toDateString(end) };
}

function intervalPeriod(anchor: Date, interval: number, today: Date): BudgetPeriod {
  const length = Math.max(Math.trunc(interval), 1);
  const diff = calendarDaysBetween(anchor, today);
  const index = diff >= 0 ? Math.floor(diff / length) : 0;
  const start = addDays(anchor, index * length);
  return {
    start: toDateString(start),
    end: toDateString(addDays(start, length - 1)),
  };
}

function weeklyAnchor(schedule: BudgetSchedule): Date {
  const weekday = schedule.weekday ?? (schedule.anchorDate ? parseDateString(schedule.anchorDate).getDay() : 1);
  const anchor = parseDateString(schedule.anchorDate ?? STABLE_EPOCH);
  const delta = (anchor.getDay() - weekday + 7) % 7;
  return addDays(anchor, -delta);
}

function repeatingAnchor(anchorDate: string | null): Date {
  return parseDateString(anchorDate ?? STABLE_EPOCH);
}

/**
 * Twice-monthly windows follow the income-plan day pair.
 * Short months clamp the chosen day, the same way pay dates do.
 * The two halves meet on the boundary so a transaction lands in one half.
 */
function semimonthlyPeriod(days: [number, number], today: Date): BudgetPeriod {
  const first = Math.min(days[0], days[1]);
  const second = Math.max(days[0], days[1]);
  const year = today.getFullYear();
  const month = today.getMonth();
  const startA = clampDayOfMonth(year, month, first);
  const startB = clampDayOfMonth(year, month, second);
  if (toDateString(startA) === toDateString(startB)) {
    return calendarMonth(today);
  }
  if (today.getTime() >= startB.getTime()) {
    const nextA = clampDayOfMonth(year, month + 1, first);
    return {
      start: toDateString(startB),
      end: toDateString(addDays(nextA, -1)),
    };
  }
  if (today.getTime() >= startA.getTime()) {
    return {
      start: toDateString(startA),
      end: toDateString(addDays(startB, -1)),
    };
  }
  const previousB = clampDayOfMonth(year, month - 1, second);
  return {
    start: toDateString(previousB),
    end: toDateString(addDays(startA, -1)),
  };
}

export function currentBudgetPeriod(input: unknown, referenceDate = new Date()): BudgetPeriod {
  const schedule = normalizeBudgetSchedule(input);
  const today = startOfDay(referenceDate);

  switch (schedule.frequency) {
    case "weekly":
      return intervalPeriod(weeklyAnchor(schedule), 7, today);
    case "biweekly":
      return intervalPeriod(repeatingAnchor(schedule.anchorDate), 14, today);
    case "custom":
      return intervalPeriod(repeatingAnchor(schedule.anchorDate), schedule.intervalDays ?? 14, today);
    case "twice_monthly":
      return semimonthlyPeriod(schedule.monthDays ?? [1, 15], today);
    default:
      return calendarMonth(today);
  }
}

export function dateInBudgetPeriod(date: string, period: BudgetPeriod): boolean {
  const key = date.slice(0, 10);
  return key >= period.start && key <= period.end;
}

export function formatBudgetPeriodLabel(period: BudgetPeriod): string {
  const start = parseDateString(period.start);
  const end = parseDateString(period.end);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startText = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
  const endText = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  if (period.start === period.end) return startText;
  return `${startText} – ${endText}`;
}

export function budgetLimitLabel(frequency: BudgetFrequency): string {
  switch (frequency) {
    case "weekly":
      return "Weekly limit";
    case "biweekly":
      return "Limit every two weeks";
    case "twice_monthly":
      return "Limit each half-month";
    case "custom":
      return "Limit for this period";
    default:
      return "Monthly limit";
  }
}

export function budgetScheduleNote(frequency: BudgetFrequency): string {
  switch (frequency) {
    case "weekly":
      return "Starts on the weekday you pick and repeats every 7 days from that date.";
    case "biweekly":
      return "Repeats every 14 days from the start date.";
    case "twice_monthly":
      return "Splits the month on these two days. Short months use the last day when needed.";
    case "custom":
      return "Repeats every set number of days from the start date.";
    default:
      return "Resets with the calendar month.";
  }
}

/**
 * One monthly figure for Safe to Spend's monthly plan.
 * Weekly * 52/12, biweekly * 26/12, twice-monthly * 2, monthly unchanged,
 * custom (amount * 365 / days) / 12. Rounded to cents per budget.
 */
export function budgetMonthlyEquivalent(amount: number, input: unknown): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const schedule = normalizeBudgetSchedule(input);
  let value = amount;
  switch (schedule.frequency) {
    case "weekly":
      value = (amount * 52) / 12;
      break;
    case "biweekly":
      value = (amount * 26) / 12;
      break;
    case "twice_monthly":
      value = amount * 2;
      break;
    case "custom":
      value = (amount * 365) / (schedule.intervalDays ?? 14) / 12;
      break;
    default:
      value = amount;
  }
  return roundBudgetCurrency(value);
}

export function sumBudgetMonthlyEquivalents(
  budgets: Array<{ category?: string; amount: number }>,
): number {
  const byCategory = new Map<string, { amount: number; input: unknown }>();
  budgets.forEach((budget, index) => {
    const category = budget.category?.trim();
    byCategory.set(category || `#${index}`, { amount: budget.amount, input: budget });
  });
  return roundBudgetCurrency(
    [...byCategory.values()].reduce(
      (total, item) => total + budgetMonthlyEquivalent(item.amount, item.input),
      0,
    ),
  );
}
