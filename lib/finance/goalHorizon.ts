import { forecastGoalSavings, type GoalForecast } from "@/lib/finance/goalForecast";
import type { IncomePlanSchedule } from "@/lib/incomePlan/types";

export type GoalHorizonProjection = {
  days: number;
  label: string;
  expectedBalance: number;
  expectedAdded: number;
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Project saved balance at a horizon from weekly contribution rate.
 * Uses actual weekly rate — not frequency ×4 shortcuts for mixed schedules.
 */
export function projectGoalBalanceAtHorizon(input: {
  current: number;
  target: number;
  weeklySavings: number;
  days: number;
}): { expectedBalance: number; expectedAdded: number } {
  const weeks = Math.max(0, input.days) / 7;
  const added = round(Math.max(0, input.weeklySavings) * weeks);
  const expectedBalance = round(
    Math.min(Math.max(0, input.target), Math.max(0, input.current) + added),
  );
  return {
    expectedBalance,
    expectedAdded: round(expectedBalance - Math.max(0, input.current)),
  };
}

export function buildGoalHorizonProjections(input: {
  current: number;
  target: number;
  weeklySavings: number;
}): GoalHorizonProjection[] {
  const horizons = [
    { days: 30, label: "30 days" },
    { days: 90, label: "90 days" },
    { days: 182, label: "6 months" },
    { days: 365, label: "1 year" },
  ] as const;

  return horizons.map((horizon) => {
    const projected = projectGoalBalanceAtHorizon({
      current: input.current,
      target: input.target,
      weeklySavings: input.weeklySavings,
      days: horizon.days,
    });
    return {
      days: horizon.days,
      label: horizon.label,
      expectedBalance: projected.expectedBalance,
      expectedAdded: projected.expectedAdded,
    };
  });
}

export function requiredContributionRates(input: {
  remaining: number;
  targetDate: Date | null;
  paySchedule?: IncomePlanSchedule | null;
  customIntervalDays?: number | null;
  referenceDate?: Date;
}): {
  requiredWeekly: number | null;
  requiredBiweekly: number | null;
  requiredMonthly: number | null;
  requiredPerPaycheck: number | null;
  canEstimate: boolean;
} {
  const reference = input.referenceDate ?? new Date();
  if (!input.targetDate || input.remaining <= 0) {
    return {
      requiredWeekly: input.remaining <= 0 ? 0 : null,
      requiredBiweekly: input.remaining <= 0 ? 0 : null,
      requiredMonthly: input.remaining <= 0 ? 0 : null,
      requiredPerPaycheck: input.remaining <= 0 ? 0 : null,
      canEstimate: input.remaining <= 0,
    };
  }

  const ms = input.targetDate.getTime() - reference.getTime();
  if (ms <= 0) {
    return {
      requiredWeekly: null,
      requiredBiweekly: null,
      requiredMonthly: null,
      requiredPerPaycheck: null,
      canEstimate: false,
    };
  }

  const weeks = ms / (7 * 86_400_000);
  const requiredWeekly = round(input.remaining / weeks);
  const forecast = forecastGoalSavings({
    current: 0,
    target: input.remaining,
    createdAt: reference.toISOString().slice(0, 10),
    weeklySavings: requiredWeekly,
    contributed: 0,
    paySchedule: input.paySchedule,
    customIntervalDays: input.customIntervalDays,
  });

  return {
    requiredWeekly,
    requiredBiweekly: round(requiredWeekly * 2),
    requiredMonthly: round(requiredWeekly * 4.33),
    requiredPerPaycheck: forecast.perPaycheckSavings,
    canEstimate: true,
  };
}

export type { GoalForecast };
