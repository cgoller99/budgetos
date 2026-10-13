import type { SavingsGoal, EditGoalInput } from "@/lib/finance/types";
import type { IncomePlanSchedule } from "@/lib/incomePlan/types";
import { createSchedule, startOfDay, toDateString } from "@/lib/recurring/schedule";
import { serializeSchedule, deserializeSchedule } from "@/lib/recurring/normalize";
import type { AutoContribution } from "@/lib/recurring/types";

const WEEKS_PER_MONTH = 4.33;
const ON_TRACK_BAND = 0.1;

export type GoalPace = "ahead" | "on_track" | "behind" | "complete";

export type GoalForecast = {
  remaining: number;
  estimatedCompletionDate: Date | null;
  weeksRemaining: number | null;
  monthsRemaining: number | null;
  timeLabel: string;
  weeklySavings: number;
  monthlySavings: number;
  perPaycheckSavings: number | null;
  pace: GoalPace;
  paceLabel: string;
};

export type StoredGoalContributionRow = {
  contribution_amount?: number | null;
  contribution_frequency?: string | null;
  start_date?: string | null;
  next_occurrence?: string | null;
  last_processed_date?: string | null;
  recurring_status?: string | null;
};

const PACE_LABEL: Record<GoalPace, string> = {
  ahead: "Ahead",
  on_track: "On track",
  behind: "Behind",
  complete: "Complete",
};

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function weeksBetween(start: Date, end: Date): number {
  const elapsedMs = startOfDay(end).getTime() - startOfDay(start).getTime();
  return Math.max(0, elapsedMs / (7 * 86_400_000));
}

function parseCreatedAt(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(value);
}

export function perPaycheckSavings(
  weeklySavings: number,
  paySchedule: IncomePlanSchedule | null | undefined,
  customIntervalDays?: number | null,
): number | null {
  if (weeklySavings <= 0 || !paySchedule) {
    return null;
  }

  const monthly = weeklySavings * WEEKS_PER_MONTH;

  switch (paySchedule) {
    case "weekly":
      return roundCurrency(weeklySavings);
    case "biweekly":
      return roundCurrency(weeklySavings * 2);
    case "twice_monthly":
      return roundCurrency(monthly / 2);
    case "monthly":
      return roundCurrency(monthly);
    case "quarterly":
      return roundCurrency(monthly * 3);
    case "yearly":
      return roundCurrency(monthly * 12);
    case "custom":
      if (!customIntervalDays || customIntervalDays <= 0) {
        return null;
      }
      return roundCurrency((weeklySavings * customIntervalDays) / 7);
    default:
      return null;
  }
}

function timeLabelFor(weeksRemaining: number | null, pace: GoalPace): string {
  if (pace === "complete" || weeksRemaining === 0) {
    return "Done";
  }

  if (weeksRemaining == null) {
    return "TBD";
  }

  const weeksText = weeksRemaining === 1 ? "1 week" : `${weeksRemaining} weeks`;
  if (weeksRemaining < 8) {
    return weeksText;
  }

  const months = Math.max(1, Math.round(weeksRemaining / WEEKS_PER_MONTH));
  const monthsText = months === 1 ? "1 month" : `${months} months`;
  return `${weeksText} · about ${monthsText}`;
}

export function forecastGoalSavings(input: {
  current: number;
  target: number;
  createdAt: string;
  weeklySavings: number;
  contributed: number;
  referenceDate?: Date;
  paySchedule?: IncomePlanSchedule | null;
  customIntervalDays?: number | null;
}): GoalForecast {
  const referenceDate = input.referenceDate ?? new Date();
  const weeklySavings = roundCurrency(Math.max(0, input.weeklySavings));
  const remaining = roundCurrency(Math.max(input.target - input.current, 0));
  const contributed = roundCurrency(Math.max(0, input.contributed));
  const weeksElapsed = weeksBetween(parseCreatedAt(input.createdAt), referenceDate);

  let pace: GoalPace;
  if (remaining <= 0) {
    pace = "complete";
  } else if (weeklySavings <= 0) {
    pace = "behind";
  } else if (weeksElapsed < 1) {
    const expected = weeklySavings * weeksElapsed;
    pace =
      contributed >= expected * (1 + ON_TRACK_BAND) && contributed - expected >= 1
        ? "ahead"
        : "on_track";
  } else {
    const expected = weeklySavings * weeksElapsed;
    const ratio = expected > 0 ? contributed / expected : 1;
    if (ratio >= 1 + ON_TRACK_BAND) {
      pace = "ahead";
    } else if (ratio <= 1 - ON_TRACK_BAND) {
      pace = "behind";
    } else {
      pace = "on_track";
    }
  }

  const weeksRemaining =
    remaining <= 0 ? 0 : weeklySavings > 0 ? Math.ceil(remaining / weeklySavings) : null;
  const estimatedCompletionDate =
    weeksRemaining == null
      ? null
      : (() => {
          const date = startOfDay(referenceDate);
          date.setDate(date.getDate() + weeksRemaining * 7);
          return date;
        })();

  return {
    remaining,
    estimatedCompletionDate,
    weeksRemaining,
    monthsRemaining:
      weeksRemaining == null
        ? null
        : Math.max(0, Math.round(weeksRemaining / WEEKS_PER_MONTH)),
    timeLabel: timeLabelFor(weeksRemaining, pace),
    weeklySavings,
    monthlySavings: roundCurrency(weeklySavings * WEEKS_PER_MONTH),
    perPaycheckSavings: perPaycheckSavings(
      weeklySavings,
      input.paySchedule,
      input.customIntervalDays,
    ),
    pace,
    paceLabel: PACE_LABEL[pace],
  };
}

export function sumGoalContributions(
  transactions: Array<{ goalId?: string | null; amount: number; date: string }>,
  goalId: string,
  createdAt: string,
): number {
  const start = createdAt.slice(0, 10);
  return roundCurrency(
    transactions.reduce((total, transaction) => {
      if (transaction.goalId !== goalId || transaction.amount <= 0) {
        return total;
      }
      if (transaction.date.slice(0, 10) < start) {
        return total;
      }
      return total + transaction.amount;
    }, 0),
  );
}

export function weeklySavingsFromContribution(
  contribution: AutoContribution | undefined,
): number | null {
  if (!contribution || contribution.amount <= 0) {
    return null;
  }

  switch (contribution.frequency) {
    case "weekly":
      return roundCurrency(contribution.amount);
    case "biweekly":
      return roundCurrency(contribution.amount / 2);
    case "monthly":
      return roundCurrency(contribution.amount / WEEKS_PER_MONTH);
    default:
      return null;
  }
}

function amountForFrequency(
  weeklySavings: number,
  frequency: AutoContribution["frequency"],
): number {
  switch (frequency) {
    case "biweekly":
      return roundCurrency(weeklySavings * 2);
    case "monthly":
      return roundCurrency(weeklySavings * WEEKS_PER_MONTH);
    default:
      return roundCurrency(weeklySavings);
  }
}

/**
 * A new plan is paused so it does not create a due contribution.
 * An existing schedule keeps its cadence, status, and dates.
 */
export function buildGoalSavingsPlan(
  existing: AutoContribution | undefined,
  weeklySavings: number,
  referenceDate = new Date(),
): AutoContribution {
  const weekly = roundCurrency(Math.max(0, weeklySavings));

  if (existing?.schedule.startDate && existing.schedule.nextOccurrence) {
    return {
      amount: amountForFrequency(weekly, existing.frequency),
      frequency: existing.frequency,
      schedule: {
        ...existing.schedule,
        frequency: existing.frequency,
        status: existing.schedule.status === "active" ? "active" : "paused",
      },
    };
  }

  return {
    amount: weekly,
    frequency: "weekly",
    schedule: createSchedule(referenceDate, "weekly", referenceDate, "paused"),
  };
}

export function goalSavingsPlanColumns(plan: AutoContribution): {
  contribution_amount: number | null;
  contribution_frequency: string | null;
  start_date: string | null;
  next_occurrence: string | null;
  last_processed_date: string | null;
  recurring_status: string | null;
} {
  if (plan.amount <= 0) {
    return {
      contribution_amount: null,
      contribution_frequency: null,
      start_date: null,
      next_occurrence: null,
      last_processed_date: null,
      recurring_status: null,
    };
  }

  return {
    contribution_amount: plan.amount,
    contribution_frequency: plan.frequency,
    ...serializeSchedule(plan.schedule),
  };
}

export function mergeGoalUpdate<T extends Record<string, unknown>>(
  base: T,
  weeklySavings: number | undefined,
  columns: ReturnType<typeof goalSavingsPlanColumns> | null,
): T {
  if (typeof weeklySavings !== "number" || !columns) {
    return base;
  }

  return { ...base, ...columns };
}

export function contributionFromStoredGoal(
  row: StoredGoalContributionRow | null | undefined,
): AutoContribution | undefined {
  if (!row?.contribution_amount || !row.contribution_frequency) {
    return undefined;
  }

  const schedule = deserializeSchedule({
    start_date: row.start_date,
    next_occurrence: row.next_occurrence,
    last_processed_date: row.last_processed_date,
    recurring_status: row.recurring_status,
    frequency: row.contribution_frequency,
  });

  if (!schedule) {
    return undefined;
  }

  return {
    amount: roundCurrency(row.contribution_amount),
    frequency: row.contribution_frequency as AutoContribution["frequency"],
    schedule,
  };
}

export function applyGoalEdit(
  goal: SavingsGoal,
  input: EditGoalInput,
  icon: string,
  referenceDate = new Date(),
): SavingsGoal {
  const next: SavingsGoal = {
    ...goal,
    name: input.name.trim(),
    type: input.type,
    icon,
    target: input.target,
  };

  if (typeof input.weeklySavings !== "number") {
    return next;
  }

  if (input.weeklySavings <= 0) {
    const rest = { ...next };
    delete rest.autoContribution;
    return rest;
  }

  return {
    ...next,
    autoContribution: buildGoalSavingsPlan(
      goal.autoContribution,
      input.weeklySavings,
      referenceDate,
    ),
  };
}

export function completionDateKey(date: Date | null): string | null {
  return date ? toDateString(date) : null;
}
