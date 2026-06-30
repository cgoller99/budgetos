import type { FinanceData, SavingsGoal } from "@/lib/finance/types";
import { calculateMonthlySavings } from "@/lib/calculations/savingsProgress";
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

export type GoalProgress = {
  id: string;
  name: string;
  icon: string;
  type: SavingsGoal["type"];
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
  const remaining = Math.max(goal.target - goal.current, 0);
  const percentComplete =
    goal.target > 0
      ? Math.min(Math.round((goal.current / goal.target) * 100), 100)
      : 0;
  const contribution = getGoalContributionBreakdown(data, goal);
  const activeGoalCount = Math.max(
    (data.savingsGoals ?? []).filter((item) => item.current < item.target).length,
    1,
  );
  const weeklyForEstimate =
    contribution.weeklyContribution > 0
      ? contribution.weeklyContribution
      : calculateMonthlySavings(data) / activeGoalCount / 4.33;

  return {
    id: goal.id,
    name: goal.name,
    icon: goal.icon,
    type: goal.type,
    current: goal.current,
    target: goal.target,
    remaining,
    percentComplete,
    estimatedCompletionDate: estimateCompletionDate(goal, weeklyForEstimate),
    isComplete: goal.current >= goal.target,
    weeklyContribution: contribution.weeklyContribution,
    monthlyContribution: contribution.monthlyContribution,
    contributionSource: contribution.source,
    contributionSourceLabel: contribution.sourceLabel,
    accentColor: getGoalAccentColor(goal.type),
    insights: getGoalInsights(goal, remaining, weeklyForEstimate),
    suggestions: getGoalSuggestions(data, goal, remaining, weeklyForEstimate),
    timeline: getGoalTimeline(data, goal.id),
    reachedMilestones: getReachedMilestones(percentComplete),
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
    return "TBD";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}
