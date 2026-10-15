import {
  forecastGoalSavings,
  weeklySavingsFromPaycheckAmount,
  type GoalForecast,
} from "@/lib/finance/goalForecast";
import type { IncomePlanSchedule } from "@/lib/incomePlan/types";

export type GoalWhatIfInput = {
  current: number;
  target: number;
  createdAt: string;
  baselineWeeklySavings: number;
  contributed?: number;
  paySchedule?: IncomePlanSchedule | null;
  customIntervalDays?: number | null;
  /** Extra dollars per week to simulate. */
  extraWeekly?: number;
  /** Extra dollars per paycheck to simulate. */
  extraPerPaycheck?: number;
  /** One-time contribution applied immediately in the simulation only. */
  oneTimeContribution?: number;
  /** Optional alternate target amount. */
  alternateTarget?: number;
};

export type GoalWhatIfResult = {
  baseline: GoalForecast;
  simulated: GoalForecast;
  weeklySavingsUsed: number;
  oneTimeApplied: number;
  daysSaved: number | null;
  weeksSaved: number | null;
  targetUsed: number;
  finishesEarlier: boolean;
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Pure What-If simulator. Never mutates saved goals or Income Plan allocations.
 */
export function simulateGoalWhatIf(input: GoalWhatIfInput): GoalWhatIfResult {
  const extraWeekly = Math.max(0, input.extraWeekly ?? 0);
  const extraPaycheckWeekly =
    input.extraPerPaycheck && input.extraPerPaycheck > 0
      ? weeklySavingsFromPaycheckAmount(
          input.extraPerPaycheck,
          input.paySchedule,
          input.customIntervalDays,
        ) ?? 0
      : 0;
  const oneTime = Math.max(0, input.oneTimeContribution ?? 0);
  const target = Math.max(0, input.alternateTarget ?? input.target);
  const weeklySavingsUsed = round(
    Math.max(0, input.baselineWeeklySavings) + extraWeekly + extraPaycheckWeekly,
  );

  const baseline = forecastGoalSavings({
    current: input.current,
    target: input.target,
    createdAt: input.createdAt,
    weeklySavings: Math.max(0, input.baselineWeeklySavings),
    contributed: input.contributed ?? 0,
    paySchedule: input.paySchedule,
    customIntervalDays: input.customIntervalDays,
  });

  const simulated = forecastGoalSavings({
    current: input.current + oneTime,
    target,
    createdAt: input.createdAt,
    weeklySavings: weeklySavingsUsed,
    contributed: (input.contributed ?? 0) + oneTime,
    paySchedule: input.paySchedule,
    customIntervalDays: input.customIntervalDays,
  });

  let daysSaved: number | null = null;
  if (baseline.estimatedCompletionDate && simulated.estimatedCompletionDate) {
    daysSaved = Math.round(
      (baseline.estimatedCompletionDate.getTime() -
        simulated.estimatedCompletionDate.getTime()) /
        86_400_000,
    );
  }

  return {
    baseline,
    simulated,
    weeklySavingsUsed,
    oneTimeApplied: oneTime,
    daysSaved,
    weeksSaved: daysSaved == null ? null : round(daysSaved / 7),
    targetUsed: target,
    finishesEarlier: (daysSaved ?? 0) > 0,
  };
}
