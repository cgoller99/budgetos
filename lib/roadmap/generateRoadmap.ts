import { calculateNetWorth } from "@/lib/calculations/netWorth";
import { formatCurrency } from "@/lib/finance/format";
import { calculateMoneyFlow } from "@/lib/finance/moneyFlow";
import type { FinanceData, Investment, SavingsGoal } from "@/lib/finance/types";
import type {
  MilestoneCategory,
  NextMilestoneSummary,
  RoadmapMilestone,
  RoadmapSummary,
} from "@/lib/roadmap/types";

const WEEKS_PER_MONTH = 4.33;
const BIWEEKS_PER_MONTH = 2.165;

function contributionToMonthly(amount: number, frequency: string): number {
  switch (frequency) {
    case "weekly":
      return amount * WEEKS_PER_MONTH;
    case "biweekly":
      return amount * BIWEEKS_PER_MONTH;
    case "monthly":
      return amount;
    default:
      return amount;
  }
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function estimateCompletionDate(
  remaining: number,
  monthlyPace: number,
  referenceDate = new Date(),
): Date | null {
  if (remaining <= 0) {
    return new Date(referenceDate);
  }

  if (monthlyPace <= 0) {
    return null;
  }

  const months = Math.ceil(remaining / monthlyPace);
  return addMonths(referenceDate, months);
}

function getNextRoundThreshold(current: number): number {
  if (current <= 0) {
    return 1_000;
  }

  const thresholds = [
    1_000, 2_500, 5_000, 7_500, 10_000, 15_000, 20_000, 25_000, 50_000,
    75_000, 100_000, 150_000, 200_000, 250_000, 500_000, 750_000, 1_000_000,
    1_500_000, 2_000_000,
  ];

  const next = thresholds.find((threshold) => threshold > current);

  if (next) {
    return next;
  }

  const magnitude = Math.pow(10, Math.ceil(Math.log10(current)));
  return Math.ceil((current * 1.25) / magnitude) * magnitude;
}

function formatPaceLabel(monthlyPace: number): string {
  if (monthlyPace <= 0) {
    return "No current pace";
  }

  return `${formatCurrency(Math.round(monthlyPace))}/mo`;
}

function buildSavingsMilestones(
  data: FinanceData,
  referenceDate: Date,
): RoadmapMilestone[] {
  const moneyFlow = calculateMoneyFlow(data);
  const activeGoals = (data.savingsGoals ?? []).filter(
    (goal) => goal.current < goal.target,
  );

  return (data.savingsGoals ?? []).map((goal) =>
    buildSavingsMilestone(goal, moneyFlow.goals, activeGoals.length, referenceDate),
  );
}

function buildSavingsMilestone(
  goal: SavingsGoal,
  totalGoalAllocation: number,
  activeGoalCount: number,
  referenceDate: Date,
): RoadmapMilestone {
  const remaining = Math.max(goal.target - goal.current, 0);
  const percentComplete =
    goal.target > 0
      ? Math.min(Math.round((goal.current / goal.target) * 100), 100)
      : 0;

  const monthlyPace = goal.autoContribution
    ? contributionToMonthly(
        goal.autoContribution.amount,
        goal.autoContribution.frequency,
      )
    : activeGoalCount > 0
      ? totalGoalAllocation / activeGoalCount
      : 0;

  const estimatedCompletionDate = estimateCompletionDate(
    remaining,
    monthlyPace,
    referenceDate,
  );

  return {
    id: `savings-${goal.id}`,
    category: "savings",
    icon: goal.icon,
    title: goal.name,
    subtitle: "Savings goal",
    currentValue: goal.current,
    targetValue: goal.target,
    remaining,
    percentComplete,
    monthlyPace,
    paceLabel: formatPaceLabel(monthlyPace),
    targetDate: estimatedCompletionDate,
    estimatedCompletionDate,
    isComplete: remaining <= 0,
  };
}

function buildDebtMilestones(
  data: FinanceData,
  referenceDate: Date,
): RoadmapMilestone[] {
  return (data.debts ?? [])
    .filter((debt) => debt.balance > 0)
    .map((debt) => {
      const monthlyPace = Math.max(
        debt.minimumPayment,
        Math.abs(debt.monthlyChange),
      );
      const estimatedCompletionDate = estimateCompletionDate(
        debt.balance,
        monthlyPace,
        referenceDate,
      );

      return {
        id: `debt-${debt.id}`,
        category: "debt" as MilestoneCategory,
        icon: "💳",
        title: `${debt.name} Paid Off`,
        subtitle: `${debt.interestRate}% APR`,
        currentValue: 0,
        targetValue: debt.balance,
        remaining: debt.balance,
        percentComplete: 0,
        monthlyPace,
        paceLabel: formatPaceLabel(monthlyPace),
        targetDate: estimatedCompletionDate,
        estimatedCompletionDate,
        isComplete: false,
      };
    });
}

function buildInvestmentMilestones(
  data: FinanceData,
  referenceDate: Date,
): RoadmapMilestone[] {
  return (data.investments ?? []).map((investment) =>
    buildInvestmentMilestone(investment, referenceDate),
  );
}

function buildInvestmentMilestone(
  investment: Investment,
  referenceDate: Date,
): RoadmapMilestone {
  const targetValue = getNextRoundThreshold(investment.value);
  const remaining = Math.max(targetValue - investment.value, 0);
  const contributionPace = investment.autoContribution
    ? contributionToMonthly(
        investment.autoContribution.amount,
        investment.autoContribution.frequency,
      )
    : investment.monthlyContribution;
  const growthPace = Math.max(investment.monthlyChange, 0);
  const monthlyPace = Math.max(contributionPace + growthPace, contributionPace);
  const percentComplete =
    targetValue > 0
      ? Math.min(Math.round((investment.value / targetValue) * 100), 100)
      : 0;
  const estimatedCompletionDate = estimateCompletionDate(
    remaining,
    monthlyPace,
    referenceDate,
  );

  return {
    id: `investment-${investment.id}`,
    category: "investment",
    icon: "📈",
    title: `${investment.name} reaches ${formatCurrency(targetValue)}`,
    subtitle: investment.type,
    currentValue: investment.value,
    targetValue,
    remaining,
    percentComplete,
    monthlyPace,
    paceLabel: formatPaceLabel(monthlyPace),
    targetDate: estimatedCompletionDate,
    estimatedCompletionDate,
    isComplete: remaining <= 0,
  };
}

function buildNetWorthMilestone(
  data: FinanceData,
  referenceDate: Date,
): RoadmapMilestone | null {
  const netWorth = calculateNetWorth(data);
  const currentValue = netWorth.value;
  const targetValue = getNextRoundThreshold(Math.max(currentValue, 0));
  const remaining = Math.max(targetValue - currentValue, 0);
  const monthlyPace = Math.max(netWorth.monthlyChange, 0);

  if (remaining <= 0 || monthlyPace <= 0) {
    return null;
  }

  const percentComplete =
    targetValue > 0
      ? Math.min(Math.round((currentValue / targetValue) * 100), 100)
      : 0;
  const estimatedCompletionDate = estimateCompletionDate(
    remaining,
    monthlyPace,
    referenceDate,
  );

  return {
    id: "net-worth-next",
    category: "net_worth",
    icon: "💎",
    title: `Net worth reaches ${formatCurrency(targetValue)}`,
    subtitle: "Wealth milestone",
    currentValue,
    targetValue,
    remaining,
    percentComplete,
    monthlyPace,
    paceLabel: formatPaceLabel(monthlyPace),
    targetDate: estimatedCompletionDate,
    estimatedCompletionDate,
    isComplete: false,
  };
}

function sortMilestones(milestones: RoadmapMilestone[]): RoadmapMilestone[] {
  return [...milestones].sort((left, right) => {
    if (left.isComplete !== right.isComplete) {
      return left.isComplete ? 1 : -1;
    }

    if (!left.estimatedCompletionDate && !right.estimatedCompletionDate) {
      return right.percentComplete - left.percentComplete;
    }

    if (!left.estimatedCompletionDate) return 1;
    if (!right.estimatedCompletionDate) return -1;

    return (
      left.estimatedCompletionDate.getTime() -
      right.estimatedCompletionDate.getTime()
    );
  });
}

function pickNextMilestone(
  milestones: RoadmapMilestone[],
): RoadmapMilestone | null {
  const upcoming = milestones.filter((milestone) => !milestone.isComplete);

  if (upcoming.length === 0) {
    return null;
  }

  return sortMilestones(upcoming)[0];
}

export function formatRoadmapDate(date: Date | null): string {
  if (!date) {
    return "TBD";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export function toNextMilestoneSummary(
  milestone: RoadmapMilestone | null,
): NextMilestoneSummary | null {
  if (!milestone) {
    return null;
  }

  return {
    id: milestone.id,
    category: milestone.category,
    name: milestone.title,
    icon: milestone.icon,
    percentComplete: milestone.percentComplete,
    estimatedCompletionDate: formatRoadmapDate(milestone.estimatedCompletionDate),
    remaining: milestone.remaining,
  };
}

export function generateRoadmap(
  data: FinanceData,
  referenceDate = new Date(),
): RoadmapSummary {
  const savings = buildSavingsMilestones(data, referenceDate);
  const debts = buildDebtMilestones(data, referenceDate);
  const investments = buildInvestmentMilestones(data, referenceDate);
  const netWorth = buildNetWorthMilestone(data, referenceDate);

  const milestones = sortMilestones([
    ...savings,
    ...debts,
    ...investments,
    ...(netWorth ? [netWorth] : []),
  ]);

  return {
    milestones,
    nextMilestone: pickNextMilestone(milestones),
  };
}
