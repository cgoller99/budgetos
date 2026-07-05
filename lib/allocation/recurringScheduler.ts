import { buildVirtualEnvelopes } from "@/lib/allocation/envelopes";
import type { RecurringContributionDue } from "@/lib/allocation/types";
import type { FinanceData } from "@/lib/finance/types";
import type { IncomePlan } from "@/lib/incomePlan/types";
import {
  advanceOccurrence,
  isActivityDue,
  parseDateString,
  toDateString,
} from "@/lib/recurring/schedule";

function isDueOnOrBefore(date: string, referenceDate: Date): boolean {
  return parseDateString(date).getTime() <= referenceDate.getTime();
}

export function getDueRecurringContributions(
  data: FinanceData,
  plan: IncomePlan | null,
  referenceDate = new Date(),
): RecurringContributionDue[] {
  if (!plan) {
    return [];
  }

  const envelopes = buildVirtualEnvelopes(data, plan);
  const due: RecurringContributionDue[] = [];

  for (const envelope of envelopes) {
    if (!envelope.contributionFrequency || !envelope.nextContributionDate) {
      continue;
    }

    if (!isDueOnOrBefore(envelope.nextContributionDate, referenceDate)) {
      continue;
    }

    due.push({
      envelopeId: envelope.id,
      allocationId: envelope.allocationId,
      entityId: envelope.entityId,
      envelopeType: envelope.envelopeType,
      name: envelope.name,
      amount: envelope.contributionAmount ?? 0,
      dueDate: envelope.nextContributionDate,
      frequency: envelope.contributionFrequency,
    });
  }

  for (const goal of data.savingsGoals) {
    if (!goal.autoContribution?.schedule || goal.autoContribution.schedule.status !== "active") {
      continue;
    }

    if (!isActivityDue(goal.autoContribution.schedule, referenceDate)) {
      continue;
    }

    due.push({
      envelopeId: goal.id,
      allocationId: null,
      entityId: goal.id,
      envelopeType: "goal",
      name: goal.name,
      amount: goal.autoContribution.amount,
      dueDate: goal.autoContribution.schedule.nextOccurrence,
      frequency: goal.autoContribution.frequency,
    });
  }

  return due;
}

export function advanceEnvelopeSchedules(
  data: FinanceData,
  plan: IncomePlan | null,
  referenceDate = new Date(),
): FinanceData {
  if (!plan || !data.envelopeBalances?.length) {
    return data;
  }

  const updated = data.envelopeBalances.map((envelope) => {
    if (!envelope.nextContributionDate || !envelope.contributionFrequency) {
      return envelope;
    }

    if (!isDueOnOrBefore(envelope.nextContributionDate, referenceDate)) {
      return envelope;
    }

    const nextDate = advanceOccurrence(
      parseDateString(envelope.nextContributionDate),
      envelope.contributionFrequency,
    );

    return {
      ...envelope,
      nextContributionDate: toDateString(nextDate),
      updatedAt: new Date().toISOString(),
    };
  });

  return {
    ...data,
    envelopeBalances: updated,
  };
}

export function processDueRecurringContributions(
  data: FinanceData,
  plan: IncomePlan | null,
  referenceDate = new Date(),
): {
  data: FinanceData;
  processedCount: number;
} {
  const due = getDueRecurringContributions(data, plan, referenceDate);

  if (due.length === 0) {
    return { data, processedCount: 0 };
  }

  const next = advanceEnvelopeSchedules(data, plan, referenceDate);
  return { data: next, processedCount: due.length };
}
