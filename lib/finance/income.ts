import { calculateMonthlyIncome } from "@/lib/calculations/cashFlow";
import { toMonthlyAmount } from "@/lib/calculations/monthlyAmount";
import { startOfDay } from "@/lib/finance/bills";
import type {
  EditIncomeInput,
  FinanceData,
  IncomeDashboardSummary,
  IncomeSource,
  IncomeTableRow,
} from "@/lib/finance/types";
import {
  getIncomeFrequencyLabel,
  normalizeIncomeFrequency,
} from "@/lib/recurring/frequencies";
import { normalizeRecurringFinanceData } from "@/lib/recurring/normalize";
import {
  createSchedule,
  daysUntil,
  parseDateString,
  toDateString,
} from "@/lib/recurring/schedule";

function defaultStartDate(referenceDate: Date, daysAgo = 120): Date {
  const start = new Date(referenceDate);
  start.setDate(start.getDate() - daysAgo);
  return start;
}

function formatPayDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  return parseDateString(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getRecurringMonthlyIncome(data: FinanceData): number {
  return (data.income ?? [])
    .filter((source) => source.schedule?.status !== "paused")
    .reduce(
      (total, source) =>
        total + toMonthlyAmount(source.amount, source.frequency),
      0,
    );
}

export function buildUpdatedIncomeSource(
  existing: IncomeSource,
  input: EditIncomeInput,
  referenceDate = new Date(),
): IncomeSource {
  const frequency = normalizeIncomeFrequency(input.frequency);
  const startDate = input.startDate
    ? parseDateString(input.startDate)
    : existing.schedule
      ? parseDateString(existing.schedule.startDate)
      : defaultStartDate(referenceDate);
  let schedule = existing.schedule;

  if (
    !schedule ||
    frequency !== normalizeIncomeFrequency(existing.frequency) ||
    input.startDate
  ) {
    schedule = createSchedule(
      startDate,
      frequency,
      referenceDate,
      schedule?.status ?? "active",
    );
  } else {
    schedule = {
      ...schedule,
      frequency,
    };
  }

  return {
    ...existing,
    name: input.name.trim(),
    amount: input.amount,
    frequency,
    category: input.category.trim(),
    depositAccountId: input.depositAccountId ?? null,
    schedule,
  };
}

export function enrichIncomeSource(
  source: IncomeSource,
  referenceDate = new Date(),
): IncomeTableRow {
  const schedule = source.schedule;
  const isActive = schedule?.status !== "paused";
  const nextPayDateRaw = schedule
    ? parseDateString(schedule.nextOccurrence)
    : null;

  return {
    id: source.id,
    name: source.name,
    amount: source.amount,
    frequencyLabel: getIncomeFrequencyLabel(source.frequency),
    nextPayDate: nextPayDateRaw
      ? formatPayDate(schedule?.nextOccurrence)
      : "—",
    lastPaid: formatPayDate(schedule?.lastProcessedDate),
    isActive,
    statusLabel: isActive ? "Active" : "Paused",
    canMarkReceived: isActive,
  };
}

export function getIncomeTableRows(
  data: FinanceData,
  referenceDate = new Date(),
): IncomeTableRow[] {
  const normalized = normalizeRecurringFinanceData(data, referenceDate);

  return (normalized.income ?? [])
    .map((source) => enrichIncomeSource(source, referenceDate))
    .sort((left, right) => {
      if (left.isActive !== right.isActive) {
        return left.isActive ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
}

export function getNextPaycheck(
  data: FinanceData,
  referenceDate = new Date(),
): IncomeDashboardSummary["nextPaycheck"] {
  const normalized = normalizeRecurringFinanceData(data, referenceDate);
  const today = startOfDay(referenceDate);

  const candidates = (normalized.income ?? []).flatMap((source) => {
    if (!source.schedule || source.schedule.status !== "active") {
      return [];
    }

    const nextDate = parseDateString(source.schedule.nextOccurrence);

    return [
      {
        id: source.id,
        name: source.name,
        amount: source.amount,
        nextDate,
      },
    ];
  });

  if (candidates.length === 0) {
    return null;
  }

  const next = [...candidates].sort(
    (left, right) => left.nextDate.getTime() - right.nextDate.getTime(),
  )[0];

  return {
    id: next.id,
    name: next.name,
    amount: next.amount,
    formattedDate: next.nextDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    daysUntil: daysUntil(next.nextDate, today),
  };
}

export function getUpcomingIncome(
  data: FinanceData,
  referenceDate = new Date(),
): Array<{
  id: string;
  name: string;
  amount: number;
  formattedDate: string;
  daysUntil: number;
}> {
  const normalized = normalizeRecurringFinanceData(data, referenceDate);
  const today = startOfDay(referenceDate);

  return (normalized.income ?? [])
    .flatMap((source) => {
      if (!source.schedule || source.schedule.status !== "active") {
        return [];
      }

      const nextDate = parseDateString(source.schedule.nextOccurrence);

      return [
        {
          id: source.id,
          name: source.name,
          amount: source.amount,
          formattedDate: nextDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          daysUntil: daysUntil(nextDate, today),
          sortKey: nextDate.getTime(),
        },
      ];
    })
    .sort((left, right) => left.sortKey - right.sortKey)
    .map(({ sortKey: _sortKey, ...item }) => item);
}

export function getIncomeDashboardSummary(
  data: FinanceData,
  referenceDate = new Date(),
): IncomeDashboardSummary {
  const normalized = normalizeRecurringFinanceData(data, referenceDate);
  const monthlyIncome = calculateMonthlyIncome(normalized, referenceDate);
  const sourceCount = normalized.income.length;
  const activeSourceCount = normalized.income.filter(
    (source) => source.schedule?.status !== "paused",
  ).length;

  return {
    monthlyIncome,
    annualIncome: monthlyIncome * 12,
    sourceCount,
    activeSourceCount,
    nextPaycheck: getNextPaycheck(normalized, referenceDate),
  };
}

export function getIncomeStatusVariant(
  isActive: boolean,
): "success" | "default" {
  return isActive ? "success" : "default";
}

export { toDateString };
