import { resolveAllocations } from "@/lib/allocation/allocationEngine";
import { buildVirtualEnvelopes } from "@/lib/allocation/envelopes";
import type {
  AllocationForecast,
  EnvelopeForecast,
  EnvelopeForecastPoint,
  ForecastHorizon,
} from "@/lib/allocation/types";
import type { FinanceData } from "@/lib/finance/types";
import type { IncomePlan } from "@/lib/incomePlan/types";
import {
  advancePayDate,
  computeNextPayDate,
} from "@/lib/incomePlan/payDates";
import { parseDateString, toDateString } from "@/lib/recurring/schedule";

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

const HORIZON_DAYS: Record<ForecastHorizon, number> = {
  "30d": 30,
  "90d": 90,
  "6mo": 183,
  "1yr": 365,
};

function collectPayDates(
  plan: IncomePlan,
  startDate: Date,
  endDate: Date,
): string[] {
  const dates: string[] = [];
  let cursor = parseDateString(plan.nextPayDate);

  if (cursor.getTime() < startDate.getTime()) {
    cursor = parseDateString(
      computeNextPayDate(
        plan.paySchedule,
        plan.anchorDate,
        startDate,
        {
          weeklyDayOfWeek: plan.weeklyDayOfWeek,
          monthlyDays: plan.monthlyDays,
          customIntervalDays: plan.customIntervalDays,
        },
      ),
    );
  }

  let guard = 0;

  while (cursor.getTime() <= endDate.getTime() && guard < 60) {
    if (cursor.getTime() >= startDate.getTime()) {
      dates.push(toDateString(cursor));
    }

    const tempPlan = { ...plan, nextPayDate: toDateString(cursor) };
    const next = advancePayDate(tempPlan);
    cursor = parseDateString(next);
    guard += 1;
  }

  return dates;
}

function forecastEnvelope(
  envelope: ReturnType<typeof buildVirtualEnvelopes>[number],
  plan: IncomePlan,
  payDates: string[],
  horizon: ForecastHorizon,
): EnvelopeForecast {
  const resolved = resolveAllocations(plan);
  const perPaycheck =
    resolved.find((item) => item.allocation.id === envelope.allocationId)
      ?.amount ?? envelope.contributionAmount ?? 0;

  const points: EnvelopeForecastPoint[] = [];
  let balance = envelope.balance;
  let totalContributions = 0;

  for (const payDate of payDates) {
    balance = roundCurrency(balance + perPaycheck);
    totalContributions = roundCurrency(totalContributions + perPaycheck);
    points.push({
      date: payDate,
      balance,
      contribution: perPaycheck,
    });
  }

  return {
    envelopeId: envelope.id,
    name: envelope.name,
    horizon,
    currentBalance: envelope.balance,
    projectedBalance: balance,
    totalContributions,
    points,
  };
}

export function projectEnvelopeBalances(
  data: FinanceData,
  plan: IncomePlan | null,
  horizon: ForecastHorizon,
  referenceDate = new Date(),
): AllocationForecast {
  const horizonDays = HORIZON_DAYS[horizon];
  const startDate = referenceDate;
  const endDate = addDays(referenceDate, horizonDays);

  if (!plan) {
    return {
      horizon,
      horizonDays,
      paycheckCount: 0,
      totalIncome: 0,
      envelopes: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const payDates = collectPayDates(plan, startDate, endDate);
  const envelopes = buildVirtualEnvelopes(data, plan);

  return {
    horizon,
    horizonDays,
    paycheckCount: payDates.length,
    totalIncome: roundCurrency(payDates.length * plan.paycheckAmount),
    envelopes: envelopes.map((envelope) =>
      forecastEnvelope(envelope, plan, payDates, horizon),
    ),
    generatedAt: new Date().toISOString(),
  };
}

export function projectAllHorizons(
  data: FinanceData,
  plan: IncomePlan | null,
  referenceDate = new Date(),
): AllocationForecast[] {
  const horizons: ForecastHorizon[] = ["30d", "90d", "6mo", "1yr"];
  return horizons.map((horizon) =>
    projectEnvelopeBalances(data, plan, horizon, referenceDate),
  );
}
