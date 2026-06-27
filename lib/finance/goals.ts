import type { FinanceData, SavingsGoal } from "@/lib/finance/types";
import { calculateMonthlySavings } from "@/lib/calculations/savingsProgress";

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
};

const PROGRESS_RING_CIRCUMFERENCE = 264;

export function getProgressRingOffset(percentComplete: number): number {
  const clamped = Math.max(0, Math.min(percentComplete, 100));
  return PROGRESS_RING_CIRCUMFERENCE * (1 - clamped / 100);
}

export function estimateCompletionDate(
  goal: SavingsGoal,
  monthlySavings: number,
  activeGoalCount: number,
): Date | null {
  const remaining = goal.target - goal.current;

  if (remaining <= 0) {
    return new Date();
  }

  const allocation =
    activeGoalCount > 0 ? monthlySavings / activeGoalCount : monthlySavings;

  if (allocation <= 0) {
    return null;
  }

  const months = Math.ceil(remaining / allocation);
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date;
}

export function enrichGoal(
  goal: SavingsGoal,
  monthlySavings: number,
  activeGoalCount: number,
): GoalProgress {
  const remaining = Math.max(goal.target - goal.current, 0);
  const percentComplete =
    goal.target > 0
      ? Math.min(Math.round((goal.current / goal.target) * 100), 100)
      : 0;

  return {
    id: goal.id,
    name: goal.name,
    icon: goal.icon,
    type: goal.type,
    current: goal.current,
    target: goal.target,
    remaining,
    percentComplete,
    estimatedCompletionDate: estimateCompletionDate(
      goal,
      monthlySavings,
      activeGoalCount,
    ),
    isComplete: goal.current >= goal.target,
  };
}

export function getGoalProgressList(data: FinanceData): GoalProgress[] {
  const monthlySavings = calculateMonthlySavings(data);
  const activeGoals = (data.savingsGoals ?? []).filter(
    (goal) => goal.current < goal.target,
  );

  return (data.savingsGoals ?? []).map((goal) =>
    enrichGoal(goal, monthlySavings, activeGoals.length || 1),
  );
}

export function getNextGoal(data: FinanceData): GoalProgress | null {
  const goals = getGoalProgressList(data).filter((goal) => !goal.isComplete);

  if (goals.length === 0) {
    return null;
  }

  return [...goals].sort((left, right) => {
    if (right.percentComplete !== left.percentComplete) {
      return right.percentComplete - left.percentComplete;
    }

    if (!left.estimatedCompletionDate) return 1;
    if (!right.estimatedCompletionDate) return -1;

    return (
      left.estimatedCompletionDate.getTime() -
      right.estimatedCompletionDate.getTime()
    );
  })[0];
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
