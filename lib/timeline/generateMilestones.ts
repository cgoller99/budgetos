import { formatCurrency } from "@/lib/finance/format";
import { getGoalTypeMeta } from "@/lib/finance/goalTypes";
import type { FinanceData } from "@/lib/finance/types";
import type { FinancialMilestone, TimelinePoint } from "./types";

const GOAL_PERCENT_THRESHOLDS = [25, 50, 75, 100] as const;
const AMOUNT_THRESHOLDS = [
  1_000, 2_500, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000,
] as const;

function estimateGoalMilestoneDate(
  createdAt: string,
  currentPercent: number,
  thresholdPercent: number,
  referenceDate = new Date(),
): Date {
  const created = new Date(createdAt);

  if (currentPercent <= 0 || thresholdPercent <= 0) {
    return created;
  }

  const progressRatio = Math.min(thresholdPercent / currentPercent, 1);
  const elapsed = referenceDate.getTime() - created.getTime();

  return new Date(created.getTime() + elapsed * progressRatio);
}

function findThresholdCrossingDate(
  timeline: TimelinePoint[],
  getValue: (point: TimelinePoint) => number,
  threshold: number,
): Date | null {
  for (let index = 1; index < timeline.length; index += 1) {
    const previous = getValue(timeline[index - 1]);
    const current = getValue(timeline[index]);

    if (previous < threshold && current >= threshold) {
      const previousDate = timeline[index - 1].date.getTime();
      const currentDate = timeline[index].date.getTime();
      const range = current - previous || 1;
      const ratio = (threshold - previous) / range;
      return new Date(previousDate + (currentDate - previousDate) * ratio);
    }
  }

  return null;
}

function getReachedAmountThresholds(current: number): number[] {
  return AMOUNT_THRESHOLDS.filter((threshold) => current >= threshold);
}

function buildGoalMilestones(
  data: FinanceData,
  referenceDate: Date,
): FinancialMilestone[] {
  const milestones: FinancialMilestone[] = [];

  for (const goal of data.savingsGoals ?? []) {
    if (goal.target <= 0) {
      continue;
    }

    const currentPercent = Math.min(
      Math.round((goal.current / goal.target) * 100),
      100,
    );
    const meta = getGoalTypeMeta(goal.type);

    for (const threshold of GOAL_PERCENT_THRESHOLDS) {
      if (currentPercent < threshold) {
        continue;
      }

      const savedAmount = Math.round((goal.target * threshold) / 100);

      milestones.push({
        id: `goal-${goal.id}-${threshold}`,
        date: estimateGoalMilestoneDate(
          goal.createdAt,
          currentPercent,
          threshold,
          referenceDate,
        ),
        icon: goal.icon || meta.icon,
        achievement: `${goal.name} reached ${threshold}%`,
        description: `${formatCurrency(savedAmount)} saved toward your ${goal.name.toLowerCase()} target.`,
      });
    }
  }

  return milestones;
}

function buildCashMilestones(
  timeline: TimelinePoint[],
  currentCash: number,
): FinancialMilestone[] {
  const milestones: FinancialMilestone[] = [];

  for (const threshold of getReachedAmountThresholds(currentCash)) {
    const crossingDate = findThresholdCrossingDate(
      timeline,
      (point) => point.cash,
      threshold,
    );

    milestones.push({
      id: `cash-${threshold}`,
      date: crossingDate ?? timeline[0]?.date ?? new Date(),
      icon: "💰",
      achievement:
        threshold === 10_000
          ? "First $10,000 Saved"
          : `Cash savings passed ${formatCurrency(threshold)}`,
      description: `Your liquid cash balance crossed ${formatCurrency(threshold)}.`,
    });
  }

  return milestones;
}

function buildNetWorthMilestones(
  timeline: TimelinePoint[],
  currentNetWorth: number,
): FinancialMilestone[] {
  const milestones: FinancialMilestone[] = [];

  for (const threshold of getReachedAmountThresholds(currentNetWorth)) {
    const crossingDate = findThresholdCrossingDate(
      timeline,
      (point) => point.netWorth,
      threshold,
    );

    milestones.push({
      id: `net-worth-${threshold}`,
      date: crossingDate ?? timeline[0]?.date ?? new Date(),
      icon: "📈",
      achievement: `Net Worth passed ${formatCurrency(threshold)}`,
      description: `Your total net worth exceeded ${formatCurrency(threshold)} for the first time.`,
    });
  }

  return milestones;
}

function buildInvestmentMilestones(
  timeline: TimelinePoint[],
  currentInvestments: number,
): FinancialMilestone[] {
  const milestones: FinancialMilestone[] = [];

  for (const threshold of getReachedAmountThresholds(currentInvestments)) {
    if (threshold < 5_000) {
      continue;
    }

    const crossingDate = findThresholdCrossingDate(
      timeline,
      (point) => point.investments,
      threshold,
    );

    milestones.push({
      id: `investments-${threshold}`,
      date: crossingDate ?? timeline[0]?.date ?? new Date(),
      icon: "📈",
      achievement: `Investments passed ${formatCurrency(threshold)}`,
      description: `Your portfolio value crossed ${formatCurrency(threshold)}.`,
    });
  }

  return milestones;
}

function findDebtDroppedBelowDate(
  timeline: TimelinePoint[],
  threshold: number,
): Date | null {
  for (let index = 1; index < timeline.length; index += 1) {
    const previous = timeline[index - 1].debt;
    const current = timeline[index].debt;

    if (previous >= threshold && current < threshold) {
      const previousDate = timeline[index - 1].date.getTime();
      const currentDate = timeline[index].date.getTime();
      const range = previous - current || 1;
      const ratio = (previous - threshold) / range;
      return new Date(previousDate + (currentDate - previousDate) * ratio);
    }
  }

  return null;
}

function buildDebtMilestones(
  data: FinanceData,
  timeline: TimelinePoint[],
): FinancialMilestone[] {
  const milestones: FinancialMilestone[] = [];
  const peakDebt = Math.max(...timeline.map((point) => point.debt), 0);
  const currentDebt = timeline.at(-1)?.debt ?? 0;

  for (const debt of data.debts ?? []) {
    if (debt.balance <= 0) {
      milestones.push({
        id: `debt-paid-${debt.id}`,
        date: timeline.at(-1)?.date ?? new Date(),
        icon: "💳",
        achievement: `${debt.name} Paid Off`,
        description: `You cleared your ${debt.name.toLowerCase()} balance.`,
      });
    }
  }

  for (const threshold of getReachedAmountThresholds(peakDebt)) {
    if (currentDebt >= threshold) {
      continue;
    }

    const crossingDate = findDebtDroppedBelowDate(timeline, threshold);

    if (!crossingDate) {
      continue;
    }

    milestones.push({
      id: `debt-below-${threshold}`,
      date: crossingDate,
      icon: "💳",
      achievement: `Debt dropped below ${formatCurrency(threshold)}`,
      description: `Total debt fell under ${formatCurrency(threshold)} for the first time.`,
    });
  }

  return milestones;
}

function dedupeMilestones(
  milestones: FinancialMilestone[],
): FinancialMilestone[] {
  const seen = new Set<string>();

  return milestones.filter((milestone) => {
    if (seen.has(milestone.id)) {
      return false;
    }

    seen.add(milestone.id);
    return true;
  });
}

export function generateMilestones(
  data: FinanceData,
  timeline: TimelinePoint[],
  referenceDate = new Date(),
): FinancialMilestone[] {
  const latest = timeline.at(-1);

  if (!latest) {
    return [];
  }

  const milestones = dedupeMilestones([
    ...buildGoalMilestones(data, referenceDate),
    ...buildCashMilestones(timeline, latest.cash),
    ...buildNetWorthMilestones(timeline, latest.netWorth),
    ...buildInvestmentMilestones(timeline, latest.investments),
    ...buildDebtMilestones(data, timeline),
  ]);

  return milestones
    .sort((left, right) => right.date.getTime() - left.date.getTime())
    .slice(0, 8);
}

export function formatMilestoneDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
