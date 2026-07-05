import { getBillProgressList } from "@/lib/finance/bills";
import {
  buildCalendarMonth,
  formatCalendarMonthLabel,
  getCalendarStatusVariant,
  getEventsForCalendarDate,
  isSameCalendarDay,
  type CalendarDaySummary,
  type CalendarEvent,
  type CalendarEventType,
  type CalendarMonthSummary,
} from "@/lib/finance/calendarEvents";
import type { FinanceData } from "@/lib/finance/types";

export {
  buildCalendarMonth,
  formatCalendarMonthLabel,
  getCalendarStatusVariant,
  getEventsForCalendarDate,
  isSameCalendarDay,
  type CalendarDaySummary,
  type CalendarEvent,
  type CalendarEventType,
  type CalendarMonthSummary,
};

export { CALENDAR_STATUS_LABELS } from "@/lib/finance/bills";

/** Backward-compatible wrapper for bill-only calendar consumers. */
export function getCalendarMonthDays(
  data: FinanceData,
  year: number,
  month: number,
  referenceDate = new Date(),
): Array<
  CalendarDaySummary & {
    bills: CalendarDaySummary["bills"];
    totalDue: number;
    dominantStatus: CalendarDaySummary["dominantStatus"];
  }
> {
  return buildCalendarMonth(data, year, month, referenceDate).map((day) => ({
    ...day,
    totalDue: day.bills.reduce((total, bill) => total + bill.amount, 0),
  }));
}

export function getBillsForCalendarDate(
  data: FinanceData,
  date: Date,
  referenceDate = new Date(),
) {
  return getBillProgressList(data, referenceDate).filter((bill) => {
    if (!bill.dueDate) {
      return false;
    }

    const key = (value: Date) =>
      `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;

    return key(bill.dueDate) === key(date);
  });
}
