import { getDefaultMonthlyTarget } from "@/lib/incomePlan/allocations";
import { computeNextPayDate } from "@/lib/incomePlan/payDates";
import { resolveAllocations } from "@/lib/allocation/allocationEngine";
import type {
  AllocationLedgerEntry,
  EnvelopeHistoryEntry,
  EnvelopeType,
  VirtualEnvelope,
} from "@/lib/allocation/types";
import type { FinanceData } from "@/lib/finance/types";
import type { IncomePlan, IncomePlanAllocation } from "@/lib/incomePlan/types";

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function paychecksPerMonth(schedule: IncomePlan["paySchedule"]): number {
  switch (schedule) {
    case "weekly":
      return 4;
    case "biweekly":
      return 2;
    case "twice_monthly":
      return 2;
    case "monthly":
      return 1;
    case "quarterly":
      return 1 / 3;
    case "yearly":
      return 1 / 12;
    default:
      return 2;
  }
}

function inferEnvelopeType(
  allocation: IncomePlanAllocation,
): EnvelopeType {
  if (allocation.goalId) return "goal";
  if (allocation.billId) return "bill";
  if (allocation.debtId) return "debt";
  if (allocation.investmentId) return "investment";
  if (allocation.accountId) return "account";
  return "category";
}

function inferEntityId(allocation: IncomePlanAllocation): string | null {
  return (
    allocation.goalId ??
    allocation.billId ??
    allocation.debtId ??
    allocation.investmentId ??
    allocation.accountId
  );
}

function inferTarget(
  data: FinanceData,
  allocation: IncomePlanAllocation,
  plan: IncomePlan,
): number | null {
  if (allocation.goalId) {
    const goal = data.savingsGoals.find((item) => item.id === allocation.goalId);
    return goal?.target ?? allocation.monthlyTarget;
  }

  if (allocation.billId) {
    const bill = data.bills.find((item) => item.id === allocation.billId);
    return bill?.amount ?? allocation.monthlyTarget;
  }

  if (allocation.monthlyTarget !== null) {
    return allocation.monthlyTarget;
  }

  const perMonth = getDefaultMonthlyTarget(
    allocation,
    paychecksPerMonth(plan.paySchedule),
    plan,
  );

  return perMonth > 0 ? perMonth : null;
}

function buildHistoryFromLedger(
  allocationId: string,
  ledger: AllocationLedgerEntry[],
): EnvelopeHistoryEntry[] {
  return ledger
    .filter((entry) => entry.allocationId === allocationId)
    .slice(0, 12)
    .map((entry) => ({
      date: entry.transferDate,
      amount: entry.amount,
      source: entry.entryType === "paycheck_allocation" ? "Paycheck" : "Scheduled",
      ledgerEntryId: entry.id,
    }));
}

export function buildVirtualEnvelopes(
  data: FinanceData,
  plan: IncomePlan | null,
): VirtualEnvelope[] {
  if (!plan) {
    return (data.envelopeBalances ?? []).map((stored) => ({
      id: stored.id,
      allocationId: stored.allocationId,
      envelopeType: stored.envelopeType as EnvelopeType,
      entityId: stored.entityId,
      name: stored.name,
      icon: stored.icon,
      balance: stored.balance,
      target: stored.target,
      contributionAmount: stored.contributionAmount,
      contributionFrequency:
        stored.contributionFrequency as VirtualEnvelope["contributionFrequency"],
      progress:
        stored.target && stored.target > 0
          ? Math.min((stored.balance / stored.target) * 100, 100)
          : stored.progress,
      nextContributionDate: stored.nextContributionDate,
      history: stored.history ?? [],
    }));
  }

  const ledger = data.allocationLedger ?? [];
  const storedByAllocation = new Map(
    (data.envelopeBalances ?? [])
      .filter((item) => item.allocationId)
      .map((item) => [item.allocationId!, item]),
  );

  const resolved = resolveAllocations(plan);

  return plan.allocations.map((allocation) => {
    const stored = storedByAllocation.get(allocation.id);
    const envelopeType = inferEnvelopeType(allocation);
    const entityId = inferEntityId(allocation);
    const target = inferTarget(data, allocation, plan);
    const resolvedAmount =
      resolved.find((item) => item.allocation.id === allocation.id)?.amount ??
      0;
    const balance = stored?.balance ?? 0;
    const progress =
      target && target > 0 ? Math.min((balance / target) * 100, 100) : 0;

    return {
      id: stored?.id ?? allocation.id,
      allocationId: allocation.id,
      envelopeType,
      entityId,
      name: allocation.name,
      icon: allocation.icon,
      balance: roundCurrency(balance),
      target,
      contributionAmount:
        stored?.contributionAmount ?? resolvedAmount,
      contributionFrequency: (stored?.contributionFrequency ??
        allocation.contributionFrequency ??
        plan.paySchedule) as VirtualEnvelope["contributionFrequency"],
      progress: roundCurrency(progress),
      nextContributionDate:
        stored?.nextContributionDate ?? plan.nextPayDate,
      history: buildHistoryFromLedger(allocation.id, ledger),
    };
  });
}

export function applyEnvelopeContribution(
  envelopes: VirtualEnvelope[],
  params: {
    allocationId: string;
    amount: number;
    date: string;
    ledgerEntryId: string;
    source?: string;
  },
): VirtualEnvelope[] {
  const { allocationId, amount, date, ledgerEntryId, source = "Paycheck" } =
    params;

  return envelopes.map((envelope) => {
    if (envelope.allocationId !== allocationId) {
      return envelope;
    }

    const historyEntry: EnvelopeHistoryEntry = {
      date,
      amount,
      source,
      ledgerEntryId,
    };

    const nextBalance = roundCurrency(envelope.balance + amount);
    const progress =
      envelope.target && envelope.target > 0
        ? Math.min((nextBalance / envelope.target) * 100, 100)
        : envelope.progress;

    return {
      ...envelope,
      balance: nextBalance,
      progress: roundCurrency(progress),
      history: [historyEntry, ...envelope.history].slice(0, 24),
    };
  });
}

export function syncStoredEnvelopesFromVirtual(
  virtual: VirtualEnvelope[],
  existing: FinanceData["envelopeBalances"] = [],
): NonNullable<FinanceData["envelopeBalances"]> {
  const existingById = new Map(existing.map((item) => [item.id, item]));

  return virtual.map((envelope) => {
    const prior = existingById.get(envelope.id);
    return {
      id: envelope.id,
      allocationId: envelope.allocationId,
      envelopeType: envelope.envelopeType,
      entityId: envelope.entityId,
      name: envelope.name,
      icon: envelope.icon,
      balance: envelope.balance,
      target: envelope.target,
      contributionAmount: envelope.contributionAmount,
      contributionFrequency: envelope.contributionFrequency,
      progress: envelope.progress,
      nextContributionDate: envelope.nextContributionDate,
      history: envelope.history,
      updatedAt: prior?.updatedAt ?? new Date().toISOString(),
    };
  });
}

export function computeNextContributionDate(
  plan: IncomePlan,
  referenceDate = new Date(),
): string {
  return computeNextPayDate(
    plan.paySchedule,
    plan.anchorDate,
    referenceDate,
    {
      weeklyDayOfWeek: plan.weeklyDayOfWeek,
      monthlyDays: plan.monthlyDays,
      customIntervalDays: plan.customIntervalDays,
    },
  );
}
