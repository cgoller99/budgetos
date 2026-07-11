import { calculateMonthlyIncome } from "@/lib/calculations/income";
import { getPersonalLedgerIncomeForMonth } from "@/lib/calculations/incomeLedger";
import { toMonthlyAmount } from "@/lib/calculations/monthlyAmount";
import {
  getEffectiveIncomeSources,
  INCOME_PLAN_SOURCE_ID,
  isIncomePlanSourceId,
  isIncomeSourceActive,
} from "@/lib/finance/effectiveIncome";
import type { FinanceData, IncomeSource } from "@/lib/finance/types";
import type { IncomePlan } from "@/lib/incomePlan/types";
import { getIncomeFrequencyLabel } from "@/lib/recurring/frequencies";

export type IncomeStreamSource =
  | "manual_recurring"
  | "income_plan"
  | "ledger_fallback";

export type IncomeStreamDiagnostic = {
  id: string;
  name: string;
  source: IncomeStreamSource;
  frequency: string;
  perPeriodAmount: number;
  monthlyAmount: number;
  annualAmount: number;
  included: boolean;
  exclusionReason: string | null;
  ownerUserId: string | null;
  isPaused: boolean;
};

export type IncomeCalculationDiagnostics = {
  viewerUserId: string | null;
  householdId: string | null;
  calculationMode: "recurring_sources" | "ledger_fallback" | "plaid_corrected";
  activeStreamCount: number;
  totalStreamsBeforeDedup: number;
  totalStreamsAfterDedup: number;
  householdStreamsExcluded: number;
  duplicateStreamsExcluded: number;
  pausedStreamsExcluded: number;
  monthlyIncomeBeforeDedup: number;
  monthlyIncomeAfterDedup: number;
  annualIncome: number;
  streams: IncomeStreamDiagnostic[];
  ledgerFallbackMonthIncome: number | null;
};

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isPersonalOwnerRow(
  ownerUserId: string | null | undefined,
  viewerUserId: string | null | undefined,
): boolean {
  if (!viewerUserId) {
    return true;
  }

  if (!ownerUserId) {
    return true;
  }

  return ownerUserId === viewerUserId;
}

function normalizeIncomeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function incomeDedupKey(source: IncomeSource): string {
  const amountBucket = Math.round(source.amount * 100);
  return [
    source.ownerUserId ?? "unknown",
    normalizeIncomeName(source.name),
    source.frequency,
    String(amountBucket),
  ].join("|");
}

export function dedupeIncomeSources(sources: IncomeSource[]): {
  sources: IncomeSource[];
  removed: IncomeSource[];
} {
  const kept = new Map<string, IncomeSource>();
  const removed: IncomeSource[] = [];

  for (const source of sources) {
    const key = incomeDedupKey(source);
    const existing = kept.get(key);

    if (!existing) {
      kept.set(key, source);
      continue;
    }

    const existingActive = isIncomeSourceActive(existing);
    const candidateActive = isIncomeSourceActive(source);

    if (candidateActive && !existingActive) {
      removed.push(existing);
      kept.set(key, source);
      continue;
    }

    removed.push(source);
  }

  return {
    sources: [...kept.values()],
    removed,
  };
}

export function filterPersonalIncomeSources(
  sources: IncomeSource[],
  viewerUserId: string | null | undefined,
): IncomeSource[] {
  if (!viewerUserId) {
    return sources;
  }

  return sources.filter((source) =>
    isPersonalOwnerRow(source.ownerUserId, viewerUserId),
  );
}

export function filterPersonalIncomePlan(
  plan: IncomePlan | null | undefined,
  viewerUserId: string | null | undefined,
): IncomePlan | null {
  if (!plan) {
    return null;
  }

  if (!viewerUserId) {
    return plan;
  }

  return isPersonalOwnerRow(plan.ownerUserId, viewerUserId) ? plan : null;
}

export { getPersonalLedgerIncomeForMonth } from "@/lib/calculations/incomeLedger";

export function diagnoseIncomeCalculation(
  data: FinanceData,
  referenceDate = new Date(),
): IncomeCalculationDiagnostics {
  const viewerUserId = data.viewerUserId ?? null;
  const householdId = data.householdId ?? null;
  const rawSources = data.income ?? [];
  const personalSources = filterPersonalIncomeSources(rawSources, viewerUserId);
  const householdStreamsExcluded = rawSources.length - personalSources.length;

  const { sources: dedupedSources, removed: duplicateSources } =
    dedupeIncomeSources(personalSources);

  const personalPlan = filterPersonalIncomePlan(data.incomePlan, viewerUserId);
  const effectiveSources = getEffectiveIncomeSources({
    ...data,
    income: dedupedSources,
    incomePlan: personalPlan,
  });

  const streams: IncomeStreamDiagnostic[] = [];
  let pausedStreamsExcluded = 0;

  for (const source of effectiveSources) {
    const active = isIncomeSourceActive(source);
    if (!active) {
      pausedStreamsExcluded += 1;
    }

    const monthlyAmount = active
      ? toMonthlyAmount(source.amount, source.frequency)
      : 0;
    const sourceType: IncomeStreamSource = isIncomePlanSourceId(source.id)
      ? "income_plan"
      : "manual_recurring";

    streams.push({
      id: source.id,
      name: source.name,
      source: sourceType,
      frequency: getIncomeFrequencyLabel(source.frequency),
      perPeriodAmount: roundCurrency(source.amount),
      monthlyAmount: roundCurrency(monthlyAmount),
      annualAmount: roundCurrency(monthlyAmount * 12),
      included: active,
      exclusionReason: active ? null : "Paused income source",
      ownerUserId: source.ownerUserId ?? null,
      isPaused: !active,
    });
  }

  for (const source of rawSources) {
    if (isPersonalOwnerRow(source.ownerUserId, viewerUserId)) {
      continue;
    }

    streams.push({
      id: source.id,
      name: source.name,
      source: "manual_recurring",
      frequency: getIncomeFrequencyLabel(source.frequency),
      perPeriodAmount: roundCurrency(source.amount),
      monthlyAmount: 0,
      annualAmount: 0,
      included: false,
      exclusionReason: "Household member income excluded from personal total",
      ownerUserId: source.ownerUserId ?? null,
      isPaused: source.schedule?.status === "paused",
    });
  }

  for (const source of duplicateSources) {
    streams.push({
      id: source.id,
      name: source.name,
      source: isIncomePlanSourceId(source.id) ? "income_plan" : "manual_recurring",
      frequency: getIncomeFrequencyLabel(source.frequency),
      perPeriodAmount: roundCurrency(source.amount),
      monthlyAmount: 0,
      annualAmount: 0,
      included: false,
      exclusionReason: "Duplicate income stream removed",
      ownerUserId: source.ownerUserId ?? null,
      isPaused: source.schedule?.status === "paused",
    });
  }

  if (data.incomePlan && !personalPlan) {
    streams.push({
      id: data.incomePlan.id,
      name: "Paycheck (Income Plan)",
      source: "income_plan",
      frequency: getIncomeFrequencyLabel(data.incomePlan.paySchedule),
      perPeriodAmount: roundCurrency(data.incomePlan.paycheckAmount),
      monthlyAmount: 0,
      annualAmount: 0,
      included: false,
      exclusionReason: "Another household member's income plan excluded",
      ownerUserId: data.incomePlan.ownerUserId ?? null,
      isPaused: !data.incomePlan.isActive,
    });
  }

  const monthlyIncomeBeforeDedup = personalSources
    .filter(isIncomeSourceActive)
    .reduce(
      (total, source) => total + toMonthlyAmount(source.amount, source.frequency),
      0,
    );

  const activeStreams = streams.filter(
    (stream) => stream.included && stream.source !== "ledger_fallback",
  );
  const monthlyIncomeAfterDedup = calculateMonthlyIncome(
    {
      ...data,
      income: dedupedSources,
      incomePlan: personalPlan,
    },
    referenceDate,
  );
  const ledgerFallbackMonthIncome =
    activeStreams.length === 0
      ? roundCurrency(getPersonalLedgerIncomeForMonth(data, referenceDate))
      : null;

  if (ledgerFallbackMonthIncome !== null && ledgerFallbackMonthIncome > 0) {
    streams.push({
      id: "__ledger_fallback__",
      name: "Current month income transactions",
      source: "ledger_fallback",
      frequency: "Monthly (actual)",
      perPeriodAmount: roundCurrency(ledgerFallbackMonthIncome),
      monthlyAmount: roundCurrency(ledgerFallbackMonthIncome),
      annualAmount: roundCurrency(ledgerFallbackMonthIncome * 12),
      included: true,
      exclusionReason: null,
      ownerUserId: viewerUserId,
      isPaused: false,
    });
  }

  const calculationMode =
    activeStreams.length === 0
      ? "ledger_fallback"
      : monthlyIncomeAfterDedup !== monthlyIncomeBeforeDedup &&
          monthlyIncomeBeforeDedup > 0
        ? "plaid_corrected"
        : "recurring_sources";

  return {
    viewerUserId,
    householdId,
    calculationMode,
    activeStreamCount: streams.filter((stream) => stream.included).length,
    totalStreamsBeforeDedup: rawSources.length + (data.incomePlan ? 1 : 0),
    totalStreamsAfterDedup: dedupedSources.length + (personalPlan ? 1 : 0),
    householdStreamsExcluded,
    duplicateStreamsExcluded: duplicateSources.length,
    pausedStreamsExcluded,
    monthlyIncomeBeforeDedup: roundCurrency(monthlyIncomeBeforeDedup),
    monthlyIncomeAfterDedup: roundCurrency(monthlyIncomeAfterDedup),
    annualIncome: roundCurrency(monthlyIncomeAfterDedup * 12),
    streams,
    ledgerFallbackMonthIncome,
  };
}

export { INCOME_PLAN_SOURCE_ID };
