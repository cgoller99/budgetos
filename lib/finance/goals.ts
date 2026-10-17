import type { FinanceData, SavingsGoal } from "@/lib/finance/types";
import {
  resolveGoalProgressAmounts,
  type GoalProgressAmounts,
} from "@/lib/finance/goalAccountLink";
import {
  getGoalAccentColor,
  getGoalContributionBreakdown,
  getGoalInsights,
  getGoalSuggestions,
  getGoalTimeline,
  getReachedMilestones,
  type GoalContributionSource,
  type GoalInsight,
  type GoalSuggestion,
  type GoalTimelineMonth,
} from "@/lib/finance/goalAnalytics";
import {
  forecastGoalSavings,
  sumGoalContributions,
  type GoalForecast,
} from "@/lib/finance/goalForecast";

export type GoalProgress = {
  id: string;
  name: string;
  icon: string;
  type: SavingsGoal["type"];
  /** Tracked progress (linked assigned amount or confirmed contributions). */
  current: number;
  target: number;
  remaining: number;
  percentComplete: number;
  estimatedCompletionDate: Date | null;
  isComplete: boolean;
  weeklyContribution: number;
  monthlyContribution: number;
  contributionSource: GoalContributionSource;
  contributionSourceLabel: string;
  accentColor: string;
  insights: GoalInsight[];
  suggestions: GoalSuggestion[];
  timeline: GoalTimelineMonth[];
  reachedMilestones: number[];
  /** Distinct money layers for the goal card. */
  progressAmounts: GoalProgressAmounts;
  /** Authoritative forecast shared with Forecast / What-If / insights. */
  forecast: GoalForecast;
};

const PROGRESS_RING_CIRCUMFERENCE = 264;

export function getProgressRingOffset(percentComplete: number): number {
  const clamped = Math.max(0, Math.min(percentComplete, 100));
  return PROGRESS_RING_CIRCUMFERENCE * (1 - clamped / 100);
}

export function estimateCompletionDate(
  goal: SavingsGoal,
  weeklyContribution: number,
): Date | null {
  const remaining = goal.target - goal.current;

  if (remaining <= 0) {
    return new Date();
  }

  if (weeklyContribution <= 0) {
    return null;
  }

  const weeks = Math.ceil(remaining / weeklyContribution);
  const date = new Date();
  date.setDate(date.getDate() + weeks * 7);
  return date;
}

export function enrichGoal(data: FinanceData, goal: SavingsGoal): GoalProgress {
  const progressAmounts = resolveGoalProgressAmounts(data, goal);
  const tracked = progressAmounts.trackedAmount;
  const remaining = Math.max(goal.target - tracked, 0);
  const percentComplete =
    goal.target > 0
      ? Math.min(Math.round((tracked / goal.target) * 100), 100)
      : 0;
  const contribution = getGoalContributionBreakdown(data, goal);
  // Authoritative weekly rate only — never invent a completion date from household averages.
  const weeklyForEstimate = contribution.weeklyContribution;
  const contributed = sumGoalContributions(
    data.transactions,
    goal.id,
    goal.createdAt,
  );
  const forecast = forecastGoalSavings({
    current: tracked,
    target: goal.target,
    createdAt: goal.createdAt,
    weeklySavings: weeklyForEstimate,
    contributed,
    paySchedule: data.incomePlan?.paySchedule ?? null,
    customIntervalDays: data.incomePlan?.customIntervalDays ?? null,
  });

  return {
    id: goal.id,
    name: goal.name,
    icon: goal.icon,
    type: goal.type,
    current: tracked,
    target: goal.target,
    remaining,
    percentComplete,
    estimatedCompletionDate: forecast.estimatedCompletionDate,
    isComplete: tracked >= goal.target,
    weeklyContribution: contribution.weeklyContribution,
    monthlyContribution: contribution.monthlyContribution,
    contributionSource: contribution.source,
    contributionSourceLabel: contribution.sourceLabel,
    accentColor: getGoalAccentColor(goal.type),
    insights: getGoalInsights(goal, remaining, weeklyForEstimate),
    suggestions: getGoalSuggestions(data, goal, remaining, weeklyForEstimate),
    timeline: getGoalTimeline(data, goal.id),
    reachedMilestones: getReachedMilestones(percentComplete),
    progressAmounts,
    forecast,
  };
}

export function getGoalProgressList(data: FinanceData): GoalProgress[] {
  return (data.savingsGoals ?? []).map((goal) => enrichGoal(data, goal));
}

export function getTopGoals(data: FinanceData, limit = 3): GoalProgress[] {
  return getGoalProgressList(data)
    .filter((goal) => !goal.isComplete)
    .sort((left, right) => {
      if (right.percentComplete !== left.percentComplete) {
        return right.percentComplete - left.percentComplete;
      }

      if (!left.estimatedCompletionDate) return 1;
      if (!right.estimatedCompletionDate) return -1;

      return (
        left.estimatedCompletionDate.getTime() -
        right.estimatedCompletionDate.getTime()
      );
    })
    .slice(0, limit);
}

export function getNextGoal(data: FinanceData): GoalProgress | null {
  return getTopGoals(data, 1)[0] ?? null;
}

export function formatGoalDate(date: Date | null): string {
  if (!date) {
    return "Not estimable yet";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}
