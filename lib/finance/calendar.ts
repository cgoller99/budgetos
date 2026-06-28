import {
  getBillProgressList,
  getBillStatusVariant,
  startOfDay,
} from "@/lib/finance/bills";
import type {
  BillProgress,
  BillStatus,
  CalendarBillEntry,
  CalendarDaySummary,
  FinanceData,
} from "@/lib/finance/types";

const STATUS_PRIORITY: Record<BillStatus, number> = {
  overdue: 0,
  due_today: 1,
  due_soon: 2,
  partial: 2,
  upcoming: 3,
  paid: 4,
};

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

export function getCalendarMonthDays(
  data: FinanceData,
  year: number,
  month: number,
  referenceDate = new Date(),
): CalendarDaySummary[] {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const days: CalendarDaySummary[] = [];

  for (let day = 1; day <= lastDay; day += 1) {
    const date = new Date(year, month, day);
    const bills = billsForDate(data, date, referenceDate);
    const entries: CalendarBillEntry[] = bills.map((bill) => ({
      id: bill.splitId,
      billId: bill.billId,
      splitId: bill.splitId,
      name: bill.name,
      amount: bill.amount,
      status: bill.status,
      statusLabel: bill.statusLabel,
      category: bill.category,
    }));

    const dominantStatus =
      entries.length === 0
        ? null
        : [...entries]
            .sort(
              (left, right) =>
                STATUS_PRIORITY[left.status] - STATUS_PRIORITY[right.status],
            )[0]?.status ?? null;

    days.push({
      date: toDateKey(date),
      day,
      bills: entries,
      totalDue: entries.reduce((total, bill) => total + bill.amount, 0),
      dominantStatus,
    });
  }

  return days;
}

export function getBillsForCalendarDate(
  data: FinanceData,
  date: Date,
  referenceDate = new Date(),
): BillProgress[] {
  return billsForDate(data, date, referenceDate);
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
