import type { FinanceData } from "@/lib/finance/types";
import type { AutoContribution, RecurringSchedule } from "@/lib/recurring/types";
import {
  createSchedule,
  parseDateString,
  toDateString,
} from "@/lib/recurring/schedule";
import { normalizeBillFrequency, normalizeIncomeFrequency } from "@/lib/recurring/frequencies";

function defaultStartDate(referenceDate: Date, daysAgo = 90): Date {
  const start = new Date(referenceDate);
  start.setDate(start.getDate() - daysAgo);
  return start;
}

function billFrequencyFromLegacy(bill: FinanceData["bills"][number]): string {
  return bill.frequency ?? "monthly";
}

function billStartDateFromDueDay(
  dueDay: number,
  referenceDate: Date,
): Date {
  if (dueDay <= 0) {
    return defaultStartDate(referenceDate, 30);
  }

  return new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    Math.min(dueDay, 28),
  );
}

function weeklyContributionAmount(monthlyAmount: number): number {
  return Math.max(25, Math.round(monthlyAmount / 4.33 / 25) * 25);
}

export function normalizeRecurringFinanceData(
  data: FinanceData,
  referenceDate = new Date(),
): FinanceData {
  const income = data.income ?? [];
  const bills = data.bills ?? [];
  const savingsGoals = data.savingsGoals ?? [];
  const investments = data.investments ?? [];

  return {
    ...data,
    income: income.map((source) => {
      if (source.schedule) {
        return {
          ...source,
          frequency: normalizeIncomeFrequency(source.frequency),
          schedule: source.schedule,
        };
      }

      const frequency = normalizeIncomeFrequency(source.frequency);
      const startDate = defaultStartDate(referenceDate, 120);

      return {
        ...source,
        frequency,
        schedule: createSchedule(startDate, frequency, referenceDate),
      };
    }),
    bills: bills.map((bill) => {
      const frequency = normalizeBillFrequency(
        bill.frequency ?? billFrequencyFromLegacy(bill),
      );
      const schedule =
        bill.schedule ??
        createSchedule(
          billStartDateFromDueDay(bill.dueDay, referenceDate),
          frequency,
          referenceDate,
          bill.recurring ? "active" : "paused",
        );

      return {
        ...bill,
        frequency,
        schedule,
      };
    }),
    savingsGoals,
    investments: investments.map((investment) => {
      const autoContribution =
        investment.autoContribution ??
        createDefaultInvestmentContribution(
          investment.monthlyContribution,
          referenceDate,
        );

      return {
        ...investment,
        autoContribution,
      };
    }),
  };
}

function createDefaultInvestmentContribution(
  monthlyContribution: number,
  referenceDate: Date,
): AutoContribution | undefined {
  if (monthlyContribution <= 0) {
    return undefined;
  }

  const amount = weeklyContributionAmount(monthlyContribution);
  const startDate = defaultStartDate(referenceDate, 45);

  return {
    amount,
    frequency: "weekly",
    schedule: createSchedule(startDate, "weekly", referenceDate),
  };
}

export function serializeSchedule(schedule: RecurringSchedule) {
  return {
    start_date: schedule.startDate,
    next_occurrence: schedule.nextOccurrence,
    last_processed_date: schedule.lastProcessedDate,
    recurring_status: schedule.status,
  };
}

export function deserializeSchedule(row: {
  start_date?: string | null;
  next_occurrence?: string | null;
  last_processed_date?: string | null;
  recurring_status?: string | null;
  frequency?: string | null;
}): RecurringSchedule | undefined {
  if (!row.start_date || !row.next_occurrence) {
    return undefined;
  }

  return {
    startDate: row.start_date,
    frequency: row.frequency ?? "monthly",
    nextOccurrence: row.next_occurrence,
    lastProcessedDate: row.last_processed_date ?? null,
    status: row.recurring_status === "paused" ? "paused" : "active",
  };
}

export function dueDateFromBill(
  bill: FinanceData["bills"][number],
  referenceDate: Date,
): Date {
  if (bill.schedule) {
    return parseDateString(bill.schedule.nextOccurrence);
  }

  if (bill.dueDay <= 0) {
    return referenceDate;
  }

  const lastDay = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1,
    0,
  ).getDate();

  return new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    Math.min(bill.dueDay, lastDay),
  );
}

export { toDateString };
