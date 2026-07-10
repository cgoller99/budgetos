import type { IncomePlan, IncomePlanSchedule } from "@/lib/incomePlan/types";
import type { FinanceData, IncomeSource } from "@/lib/finance/types";
import type { IncomeFrequency } from "@/lib/recurring/types";
import { normalizeIncomeFrequency } from "@/lib/recurring/frequencies";
import {
  dedupeIncomeSources,
  filterPersonalIncomePlan,
  filterPersonalIncomeSources,
} from "@/lib/finance/personalIncomeScope";

/** Synthetic income row derived from an active Income Plan. */
export const INCOME_PLAN_SOURCE_ID = "__buxme_income_plan__";

function mapPayScheduleToFrequency(schedule: IncomePlanSchedule): IncomeFrequency {
  switch (schedule) {
    case "weekly":
      return "weekly";
    case "biweekly":
      return "biweekly";
    case "twice_monthly":
      return "twice_monthly";
    case "monthly":
      return "monthly";
    case "quarterly":
      return "quarterly";
    case "yearly":
      return "yearly";
    case "custom":
      return "every_2_weeks";
    default:
      return "monthly";
  }
}

function hasOverlappingIncomeSource(
  sources: IncomeSource[],
  plan: IncomePlan,
): boolean {
  const planFrequency = mapPayScheduleToFrequency(plan.paySchedule);

  return sources.some((source) => {
    if (source.schedule?.status === "paused") {
      return false;
    }

    const name = source.name.trim().toLowerCase();
    if (name.includes("paycheck") || name.includes("salary")) {
      return true;
    }

    if (plan.paycheckAmount <= 0) {
      return false;
    }

    const amountMatch =
      Math.abs(source.amount - plan.paycheckAmount) / plan.paycheckAmount <= 0.02;
    const frequencyMatch =
      normalizeIncomeFrequency(source.frequency) === planFrequency;

    return amountMatch && frequencyMatch;
  });
}

export function incomePlanToIncomeSource(plan: IncomePlan): IncomeSource | null {
  if (!plan.isActive || plan.paycheckAmount <= 0) {
    return null;
  }

  return {
    id: INCOME_PLAN_SOURCE_ID,
    name: "Paycheck (Income Plan)",
    amount: plan.paycheckAmount,
    frequency: mapPayScheduleToFrequency(plan.paySchedule),
    category: "Paycheck",
    depositAccountId: plan.depositAccountId,
    ownerUserId: plan.ownerUserId ?? null,
    schedule: {
      startDate: plan.anchorDate,
      frequency: mapPayScheduleToFrequency(plan.paySchedule),
      nextOccurrence: plan.nextPayDate,
      lastProcessedDate: plan.lastProcessedDate,
      status: plan.isActive ? "active" : "paused",
    },
  };
}

export function isIncomeSourceActive(source: IncomeSource): boolean {
  return source.schedule?.status !== "paused";
}

export function getEffectiveIncomeSources(data: FinanceData): IncomeSource[] {
  const viewerUserId = data.viewerUserId ?? null;
  const personalSources = dedupeIncomeSources(
    filterPersonalIncomeSources(data.income ?? [], viewerUserId),
  ).sources;
  const plan = filterPersonalIncomePlan(data.incomePlan, viewerUserId);

  if (!plan) {
    return personalSources;
  }

  if (hasOverlappingIncomeSource(personalSources, plan)) {
    return personalSources;
  }

  const planSource = incomePlanToIncomeSource(plan);

  if (planSource) {
    return [...personalSources, planSource];
  }

  return personalSources;
}

export function withEffectiveIncome(data: FinanceData): FinanceData {
  return {
    ...data,
    income: getEffectiveIncomeSources(data),
  };
}

export function isIncomePlanSourceId(id: string): boolean {
  return id === INCOME_PLAN_SOURCE_ID;
}
