import { getBillProgressList, getBillStatusVariant, startOfDay } from "@/lib/finance/bills";
import {
  getEffectiveIncomeSources,
  isIncomeSourceActive,
} from "@/lib/finance/effectiveIncome";
import type { BillProgress, BillStatus, FinanceData } from "@/lib/finance/types";
import { normalizeRecurringFinanceData } from "@/lib/recurring";
import { parseDateString, toDateString } from "@/lib/recurring/schedule";

export type CalendarEventType =
  | "bill"
  | "income"
  | "goal"
  | "debt"
  | "investment"
  | "allocation";

export type CalendarEvent = {
  id: string;
  type: CalendarEventType;
  name: string;
  amount: number;
  statusLabel: string;
  category?: string;
};

export type CalendarDaySummary = {
  date: string;
  day: number;
  events: CalendarEvent[];
  totalDue: number;
  dominantStatus: BillStatus | null;
  /** @deprecated use events */
  bills: Array<{
    id: string;
    billId: string;
    splitId: string;
    name: string;
    amount: number;
    status: BillStatus;
    statusLabel: string;
    category: string;
  }>;
  /** @deprecated use events */
  totalDueLegacy: number;
};

export type CalendarMonthSummary = CalendarDaySummary[];

const STATUS_PRIORITY: Record<BillStatus, number> = {
  overdue: 0,
  due_today: 1,
  due_soon: 2,
  partial: 2,
  upcoming: 3,
  paid: 4,
};

function toDateKey(date: Date): string {
  return toDateString(date);
}

function billsForDate(
  data: FinanceData,
  date: Date,
  referenceDate: Date,
): BillProgress[] {
  return getBillProgressList(data, referenceDate).filter((bill) => {
    if (!bill.dueDate) {
      return false;
    }

    return toDateKey(bill.dueDate) === toDateKey(date);
  });
}

function incomeEventsForDate(
  data: FinanceData,
  date: Date,
): CalendarEvent[] {
  return getEffectiveIncomeSources(data).flatMap((source) => {
    if (!isIncomeSourceActive(source) || !source.schedule) {
      return [];
    }

    const nextDate = parseDateString(source.schedule.nextOccurrence);
    if (toDateKey(nextDate) !== toDateKey(date)) {
      return [];
    }

    return [
      {
        id: `income-${source.id}`,
        type: "income" as const,
        name: source.name,
        amount: source.amount,
        statusLabel: "Expected",
      },
    ];
  });
}

function goalEventsForDate(data: FinanceData, date: Date): CalendarEvent[] {
  return (data.savingsGoals ?? []).flatMap((goal) => {
    if (!goal.autoContribution?.schedule || goal.autoContribution.schedule.status !== "active") {
      return [];
    }

    const nextDate = parseDateString(goal.autoContribution.schedule.nextOccurrence);
    if (toDateKey(nextDate) !== toDateKey(date)) {
      return [];
    }

    return [
      {
        id: `goal-${goal.id}`,
        type: "goal" as const,
        name: goal.name,
        amount: goal.autoContribution.amount,
        statusLabel: "Contribution",
      },
    ];
  });
}

function debtEventsForDate(data: FinanceData, date: Date): CalendarEvent[] {
  return (data.debts ?? []).flatMap((debt) => {
    const dueDay = Math.min(Math.max(debt.dueDay, 1), 28);
    if (date.getDate() !== dueDay) {
      return [];
    }

    return [
      {
        id: `debt-${debt.id}`,
        type: "debt" as const,
        name: debt.name,
        amount: debt.minimumPayment,
        statusLabel: "Payment due",
      },
    ];
  });
}

function investmentEventsForDate(data: FinanceData, date: Date): CalendarEvent[] {
  return (data.investments ?? []).flatMap((investment) => {
    const schedule = investment.autoContribution?.schedule;
    if (!schedule || schedule.status !== "active") {
      return [];
    }

    const nextDate = parseDateString(schedule.nextOccurrence);
    if (toDateKey(nextDate) !== toDateKey(date)) {
      return [];
    }

    return [
      {
        id: `investment-${investment.id}`,
        type: "investment" as const,
        name: investment.name,
        amount: investment.monthlyContribution,
        statusLabel: "Contribution",
      },
    ];
  });
}

function allocationEventsForDate(data: FinanceData, date: Date): CalendarEvent[] {
  const plan = data.incomePlan;
  if (!plan?.nextPayDate) {
    return [];
  }

  const payDate = parseDateString(plan.nextPayDate);
  if (toDateKey(payDate) !== toDateKey(date)) {
    return [];
  }

  return [
    {
      id: `paycheck-${plan.id}`,
      type: "allocation" as const,
      name: "Paycheck plan",
      amount: plan.paycheckAmount,
      statusLabel: "Income plan",
    },
  ];
}

export function buildCalendarMonth(
  data: FinanceData,
  year: number,
  month: number,
  referenceDate = new Date(),
): CalendarMonthSummary {
  const normalized = normalizeRecurringFinanceData(data, referenceDate);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const days: CalendarDaySummary[] = [];

  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(year, month, day);
    const bills = billsForDate(normalized, date, referenceDate);
    const billEvents: CalendarEvent[] = bills.map((bill) => ({
      id: bill.splitId,
      type: "bill",
      name: bill.name,
      amount: bill.amount,
      statusLabel: bill.statusLabel,
      category: bill.category,
    }));

    const events = [
      ...billEvents,
      ...incomeEventsForDate(normalized, date),
      ...goalEventsForDate(normalized, date),
      ...debtEventsForDate(normalized, date),
      ...investmentEventsForDate(normalized, date),
      ...allocationEventsForDate(normalized, date),
    ];

    const dominantStatus =
      billEvents.length === 0
        ? null
        : [...bills]
            .sort(
              (left, right) =>
                STATUS_PRIORITY[left.status] - STATUS_PRIORITY[right.status],
            )[0]?.status ?? null;

    const legacyBills = bills.map((bill) => ({
      id: bill.splitId,
      billId: bill.billId,
      splitId: bill.splitId,
      name: bill.name,
      amount: bill.amount,
      status: bill.status,
      statusLabel: bill.statusLabel,
      category: bill.category,
    }));

    days.push({
      date: toDateKey(date),
      day,
      events,
      totalDue: events.reduce((total, event) => total + event.amount, 0),
      dominantStatus,
      bills: legacyBills,
      totalDueLegacy: legacyBills.reduce((total, bill) => total + bill.amount, 0),
    });
  }

  return days;
}

export function getEventsForCalendarDate(
  data: FinanceData,
  date: Date,
  referenceDate = new Date(),
): CalendarEvent[] {
  const month = buildCalendarMonth(
    data,
    date.getFullYear(),
    date.getMonth(),
    referenceDate,
  );
  const key = toDateKey(date);
  return month.find((day) => day.date === key)?.events ?? [];
}

export function getCalendarStatusVariant(
  status: BillStatus | null,
): ReturnType<typeof getBillStatusVariant> {
  if (!status) {
    return "default";
  }

  return getBillStatusVariant(status);
}

export function formatCalendarMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function isSameCalendarDay(left: Date, right: Date): boolean {
  return startOfDay(left).getTime() === startOfDay(right).getTime();
}

export { CALENDAR_STATUS_LABELS } from "@/lib/finance/bills";
