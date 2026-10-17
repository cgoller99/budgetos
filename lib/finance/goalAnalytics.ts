import { resolveAllocations } from "@/lib/allocation/allocationEngine";
import type { FinanceData, SavingsGoal, Transaction } from "@/lib/finance/types";
import { weeklySavingsFromPaycheckAmount } from "@/lib/finance/goalForecast";
import { getGoalTypeMeta } from "@/lib/finance/goalTypes";
import { calculateMoneyLeftUntilPayday } from "@/lib/finance/moneyLeftUntilPayday";
import { buildPaycheckPlanSummary } from "@/lib/finance/paycheckPlanSummary";
import { formatCurrency } from "@/lib/finance/format";

export type GoalContributionSource =
  | "manual"
  | "income_plan"
  | "automatic"
  | "mixed"
  | "none";

export type GoalInsight = {
  id: string;
  message: string;
  tone: "positive" | "neutral" | "accent";
};

export type GoalSuggestion = {
  id: string;
  message: string;
};

export type GoalTimelineMonth = {
  monthKey: string;
  label: string;
  amount: number;
};

export type GoalContributionBreakdown = {
  weeklyContribution: number;
  monthlyContribution: number;
  source: GoalContributionSource;
  sourceLabel: string;
};

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function getGoalTransactions(data: FinanceData, goalId: string): Transaction[] {
  return data.transactions.filter(
    (transaction) => transaction.goalId === goalId && transaction.amount > 0,
  );
}

function isIncomePlanContribution(transaction: Transaction): boolean {
  return transaction.notes?.includes("Income Plan") ?? false;
}

function plannedPaycheckDollars(data: FinanceData, goalId: string): number {
  const plan = data.incomePlan;
  if (!plan) {
    return 0;
  }

  return roundCurrency(
    resolveAllocations(plan)
      .filter((item) => item.allocation.goalId === goalId)
      .reduce((total, item) => total + item.amount, 0),
  );
}

/** Weekly savings implied by paycheck allocations for this goal. Does not change the saved balance. */
export function paycheckWeeklyForGoal(data: FinanceData, goalId: string): number {
  const plan = data.incomePlan;
  if (!plan) {
    return 0;
  }

  return (
    weeklySavingsFromPaycheckAmount(
      plannedPaycheckDollars(data, goalId),
      plan.paySchedule,
      plan.customIntervalDays,
    ) ?? 0
  );
}

export function getGoalContributionBreakdown(
  data: FinanceData,
  goal: SavingsGoal,
): GoalContributionBreakdown {
  const incomeWeekly = paycheckWeeklyForGoal(data, goal.id);
  const autoAmount = goal.autoContribution?.amount ?? 0;
  const autoWeekly =
    goal.autoContribution?.frequency === "weekly"
      ? autoAmount
      : goal.autoContribution?.frequency === "biweekly"
        ? autoAmount / 2
        : goal.autoContribution?.frequency === "monthly"
          ? autoAmount / 4.33
          : 0;

  if (incomeWeekly > 0 && autoWeekly > 0) {
    // Income Plan goalId allocation is authoritative for this goal.
    // Do not stack a separate auto schedule as the same planned money.
    return {
      weeklyContribution: roundCurrency(incomeWeekly),
      monthlyContribution: roundCurrency(incomeWeekly * 4.33),
      source: "income_plan",
      sourceLabel: "Income Plan (paycheck allocation)",
    };
  }

  if (incomeWeekly > 0) {
    return {
      weeklyContribution: roundCurrency(incomeWeekly),
      monthlyContribution: roundCurrency(incomeWeekly * 4.33),
      source: "income_plan",
      sourceLabel: "Income Plan",
    };
  }

  if (autoWeekly > 0) {
    return {
      weeklyContribution: roundCurrency(autoWeekly),
      monthlyContribution: roundCurrency(autoWeekly * 4.33),
      source: "automatic",
      sourceLabel: "Automatic",
    };
  }

  const transactions = getGoalTransactions(data, goal.id);
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
  const cutoff = eightWeeksAgo.toISOString().slice(0, 10);
  const recent = transactions.filter((transaction) => transaction.date >= cutoff);
  const weeklyFromHistory =
    recent.length > 0
      ? recent.reduce((total, transaction) => total + transaction.amount, 0) / 8
      : 0;

  if (weeklyFromHistory > 0) {
    const hasPlan = recent.some(isIncomePlanContribution);
    const hasManual = recent.some((transaction) => !isIncomePlanContribution(transaction));

    return {
      weeklyContribution: roundCurrency(weeklyFromHistory),
      monthlyContribution: roundCurrency(weeklyFromHistory * 4.33),
      source: hasPlan && hasManual ? "mixed" : hasPlan ? "income_plan" : "manual",
      sourceLabel:
        hasPlan && hasManual
          ? "Mixed"
          : hasPlan
            ? "Income Plan"
            : "Manual",
    };
  }

  return {
    weeklyContribution: 0,
    monthlyContribution: 0,
    source: "none",
    sourceLabel: "Manual",
  };
}

export function getGoalTimeline(
  data: FinanceData,
  goalId: string,
  months = 6,
): GoalTimelineMonth[] {
  const transactions = getGoalTransactions(data, goalId);
  const buckets = new Map<string, number>();

  for (const transaction of transactions) {
    const monthKey = transaction.date.slice(0, 7);
    buckets.set(monthKey, (buckets.get(monthKey) ?? 0) + transaction.amount);
  }

  const results: GoalTimelineMonth[] = [];
  const cursor = new Date();

  for (let index = months - 1; index >= 0; index -= 1) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth() - index, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    results.push({
      monthKey,
      label: date.toLocaleDateString("en-US", { month: "short" }),
      amount: roundCurrency(buckets.get(monthKey) ?? 0),
    });
  }

  return results;
}

function weeksUntilCompletion(remaining: number, weeklyContribution: number): number | null {
  if (remaining <= 0) {
    return 0;
  }

  if (weeklyContribution <= 0) {
    return null;
  }

  return Math.ceil(remaining / weeklyContribution);
}

function monthsSoonerIfIncrease(
  remaining: number,
  weeklyContribution: number,
  increase: number,
): number | null {
  const currentWeeks = weeksUntilCompletion(remaining, weeklyContribution);
  const boostedWeeks = weeksUntilCompletion(remaining, weeklyContribution + increase);

  if (currentWeeks === null || boostedWeeks === null) {
    return null;
  }

  const diffWeeks = currentWeeks - boostedWeeks;
  return diffWeeks > 0 ? Math.max(1, Math.round(diffWeeks / 4.33)) : null;
}

export function getGoalInsights(
  goal: SavingsGoal,
  remaining: number,
  weeklyContribution: number,
): GoalInsight[] {
  const insights: GoalInsight[] = [];
  const increaseMonths = monthsSoonerIfIncrease(remaining, weeklyContribution, 25);

  if (increaseMonths) {
    insights.push({
      id: "boost-25",
      message: `If you increase contributions by $25/week you'll reach this goal ${increaseMonths} month${increaseMonths === 1 ? "" : "s"} sooner.`,
      tone: "accent",
    });
  }

  if (weeklyContribution > 0 && remaining > 0) {
    insights.push({
      id: "skip-contribution",
      message: "If you skip one contribution you'll finish about 1 week later.",
      tone: "neutral",
    });
  }

  return insights.slice(0, 2);
}

export function getGoalSuggestions(
  data: FinanceData,
  goal: SavingsGoal,
  remaining: number,
  weeklyContribution: number,
): GoalSuggestion[] {
  const suggestions: GoalSuggestion[] = [];
  const weeks = weeksUntilCompletion(remaining, weeklyContribution);
  const moneyLeft = calculateMoneyLeftUntilPayday(data);
  const paycheck = buildPaycheckPlanSummary(data);

  if (weeks !== null && weeks > 0) {
    const finish = new Date();
    finish.setDate(finish.getDate() + weeks * 7);
    suggestions.push({
      id: "weeks-to-finish",
      message: `At your current pace, ${goal.name} is projected around ${finish.toLocaleDateString("en-US", { month: "short", year: "numeric" })}.`,
    });
  } else if (remaining > 0 && weeklyContribution <= 0) {
    suggestions.push({
      id: "no-schedule",
      message: "Completion date cannot be estimated yet — add a contribution schedule or Income Plan allocation.",
    });
  }

  const boost = 15;
  const soonerMonths = monthsSoonerIfIncrease(remaining, weeklyContribution, boost);
  if (soonerMonths && moneyLeft.moneyLeftAfterCommitments >= boost) {
    suggestions.push({
      id: "boost-15",
      message: `Increase contributions by ${formatCurrency(boost)}/week to reach your goal about ${soonerMonths} month${soonerMonths === 1 ? "" : "s"} earlier.`,
    });
  }

  if (paycheck && remaining > 0) {
    const required =
      weeklyContribution > 0
        ? null
        : paycheck.expectedPaycheck > 0
          ? roundCurrency(Math.min(remaining, moneyLeft.moneyLeftAfterCommitments))
          : null;
    if (paycheck.remainingUnallocated > 0 && moneyLeft.moneyLeftAfterCommitments > 0) {
      const available = roundCurrency(
        Math.min(paycheck.remainingUnallocated, moneyLeft.moneyLeftAfterCommitments),
      );
      if (available >= 1) {
        suggestions.push({
          id: "unallocated-paycheck",
          message: `You have ${formatCurrency(available)} unallocated in your paycheck plan that could go toward this goal.`,
        });
      }
    } else if (
      paycheck.savingsGoalAllocations > moneyLeft.moneyLeftAfterCommitments &&
      moneyLeft.moneyLeftAfterCommitments >= 0
    ) {
      suggestions.push({
        id: "overcommitted",
        message: `Your current planned savings may exceed available money until payday (${formatCurrency(moneyLeft.moneyLeftAfterCommitments)} left after commitments).`,
      });
    } else if (required != null && required > 0) {
      suggestions.push({
        id: "per-paycheck-need",
        message: `You need about ${formatCurrency(required)} from available paycheck money to move this goal forward.`,
      });
    }
  }

  return suggestions.slice(0, 3);
}

export function getReachedMilestones(percentComplete: number): number[] {
  return [25, 50, 75, 100].filter((milestone) => percentComplete >= milestone);
}

export function getGoalAccentColor(type: SavingsGoal["type"]): string {
  return getGoalTypeMeta(type).accent;
}
