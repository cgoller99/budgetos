import type { FinanceData } from "@/lib/finance/types";
import {
  getBillFrequencyLabel,
  getContributionFrequencyLabel,
} from "@/lib/recurring/frequencies";
import { isActivityDue } from "@/lib/recurring/schedule";
import type { TodayActivity, TodayActivitySummary } from "@/lib/recurring/types";

function buildActivityId(
  entityType: TodayActivity["entityType"],
  entityId: string,
): string {
  return `${entityType}:${entityId}`;
}

export function generateTodayActivity(
  data: FinanceData,
  referenceDate = new Date(),
): TodayActivitySummary {
  const activities: TodayActivity[] = [];

  for (const income of data.income ?? []) {
    if (!income.schedule || !isActivityDue(income.schedule, referenceDate)) {
      continue;
    }

    activities.push({
      id: buildActivityId("income", income.id),
      entityType: "income",
      entityId: income.id,
      icon: "💵",
      label: `${income.name} — Paycheck received`,
      amount: income.amount,
      applied: false,
    });
  }

  for (const bill of data.bills ?? []) {
    if (!bill.schedule || !isActivityDue(bill.schedule, referenceDate)) {
      continue;
    }

    activities.push({
      id: buildActivityId("bill", bill.id),
      entityType: "bill",
      entityId: bill.id,
      icon: "📋",
      label: `${bill.name} — Bill due`,
      amount: bill.amount,
      applied: false,
    });
  }

  for (const goal of data.savingsGoals ?? []) {
    const contribution = goal.autoContribution;

    if (
      !contribution ||
      !isActivityDue(contribution.schedule, referenceDate) ||
      goal.current >= goal.target
    ) {
      continue;
    }

    activities.push({
      id: buildActivityId("goal", goal.id),
      entityType: "goal",
      entityId: goal.id,
      icon: goal.icon,
      label: `Recurring savings contribution — ${goal.name}`,
      amount: contribution.amount,
      applied: false,
    });
  }

  for (const investment of data.investments ?? []) {
    const contribution = investment.autoContribution;

    if (!contribution || !isActivityDue(contribution.schedule, referenceDate)) {
      continue;
    }

    const frequencyLabel = getContributionFrequencyLabel(contribution.frequency);

    activities.push({
      id: buildActivityId("investment", investment.id),
      entityType: "investment",
      entityId: investment.id,
      icon: "📈",
      label: `${frequencyLabel} ${investment.name} Contribution`,
      amount: contribution.amount,
      applied: false,
    });
  }

  return {
    activities: activities.sort((left, right) => left.label.localeCompare(right.label)),
    pendingCount: activities.length,
  };
}

export function parseActivityId(activityId: string): {
  entityType: TodayActivity["entityType"];
  entityId: string;
} | null {
  const [entityType, entityId] = activityId.split(":");

  if (
    !entityId ||
    (entityType !== "income" &&
      entityType !== "bill" &&
      entityType !== "goal" &&
      entityType !== "investment")
  ) {
    return null;
  }

  return {
    entityType,
    entityId,
  };
}

export { getBillFrequencyLabel };
