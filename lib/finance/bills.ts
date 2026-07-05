import { toMonthlyAmount } from "@/lib/calculations/monthlyAmount";
import { calculateMonthlyIncome, calculateMonthlySpending } from "@/lib/calculations/cashFlow";
import { getSafeToSpend } from "@/lib/finance/safeToSpend";
import { isCashAccountType } from "@/lib/finance/accountTypes";
import {
  getSplitPaidAmount,
  getSplitRemainingAmount,
} from "@/lib/finance/billPayments";
import {
  getEffectiveBillSplits,
  getSplitDisplayName,
  getSplitDueDate,
  getSplitStatus,
} from "@/lib/finance/billSplits";
import type {
  Bill,
  BillProgress,
  BillsDashboardSummary,
  BillSplit,
  BillStatus,
  EditBillInput,
  FinanceData,
} from "@/lib/finance/types";
import { normalizeBillFrequency } from "@/lib/recurring/frequencies";
import {
  createSchedule,
  isActivityDue,
  isSameDay,
  parseDateString,
  startOfDay,
} from "@/lib/recurring/schedule";

const DUE_SOON_DAYS = 3;

export const CALENDAR_STATUS_LABELS: Record<BillStatus, string> = {
  upcoming: "Upcoming",
  due_soon: "Due Soon",
  due_today: "Due Today",
  overdue: "Overdue",
  partial: "Partial",
  paid: "Paid",
};

const STATUS_LABELS = CALENDAR_STATUS_LABELS;

const MS_PER_DAY = 86_400_000;

export function getCurrentYearMonth(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

export { startOfDay };

export function getDueDateForMonth(
  dueDay: number,
  referenceDate: Date,
): Date | null {
  if (dueDay <= 0) {
    return null;
  }

  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(dueDay, lastDay);

  return new Date(year, month, day);
}

function getBillDueDate(
  bill: Bill,
  referenceDate: Date,
): Date | null {
  if (bill.schedule?.status === "paused") {
    return null;
  }

  if (bill.schedule) {
    return parseDateString(bill.schedule.nextOccurrence);
  }

  const splits = getEffectiveBillSplits(bill);
  const unpaidSplit = splits.find(
    (split) => getSplitStatus(split, referenceDate) !== "paid",
  );

  if (unpaidSplit) {
    return getSplitDueDate(unpaidSplit, referenceDate);
  }

  return getDueDateForMonth(bill.dueDay, referenceDate);
}

export function getBillStatus(
  bill: Bill,
  referenceDate = new Date(),
): BillStatus {
  const splits = getEffectiveBillSplits(bill);

  if (splits.length > 1 || (bill.splits ?? []).length > 0) {
    const statuses = splits.map((split) => getSplitStatus(split, referenceDate));

    if (statuses.every((status) => status === "paid")) {
      return "paid";
    }

    if (statuses.includes("overdue")) {
      return "overdue";
    }

    if (statuses.includes("due_today")) {
      return "due_today";
    }

    if (statuses.includes("due_soon")) {
      return "due_soon";
    }

    return "upcoming";
  }

  if (bill.schedule) {
    if (bill.schedule.status === "paused") {
      return "upcoming";
    }

    const today = startOfDay(referenceDate);
    const nextDue = startOfDay(parseDateString(bill.schedule.nextOccurrence));

    if (bill.schedule.lastProcessedDate) {
      const lastProcessed = startOfDay(
        parseDateString(bill.schedule.lastProcessedDate),
      );

      if (isSameDay(lastProcessed, today)) {
        return "paid";
      }
    }

    if (isSameDay(nextDue, today)) {
      return isActivityDue(bill.schedule, referenceDate) ? "due_today" : "paid";
    }

    if (nextDue < today) {
      return isActivityDue(bill.schedule, referenceDate) ? "overdue" : "paid";
    }

    const daysUntilDue = Math.ceil(
      (nextDue.getTime() - today.getTime()) / MS_PER_DAY,
    );

    if (daysUntilDue <= DUE_SOON_DAYS) {
      return "due_soon";
    }

    return "upcoming";
  }

  return getSplitStatus(splits[0], referenceDate);
}

export function formatBillDueDate(
  dueDate: Date | null,
  dueDay: number,
): string {
  if (dueDay <= 0 && !dueDate) {
    return "Flexible";
  }

  if (!dueDate) {
    return "—";
  }

  return dueDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function enrichBillSplit(
  bill: Bill,
  split: BillSplit,
  referenceDate = new Date(),
): BillProgress {
  const splits = getEffectiveBillSplits(bill);
  const dueDate = getSplitDueDate(split, referenceDate);
  const status = getSplitStatus(split, referenceDate);
  const displayName = getSplitDisplayName(bill.name, split, splits.length);
  const paidAmount = getSplitPaidAmount(split, referenceDate);
  const remainingAmount = getSplitRemainingAmount(split, referenceDate);

  return {
    id: split.id,
    billId: bill.id,
    splitId: split.id,
    name: displayName,
    category: bill.category,
    amount: split.amount,
    paidAmount,
    remainingAmount,
    dueDay: split.dueDay,
    dueDate,
    formattedDueDate: formatBillDueDate(dueDate, split.dueDay),
    autopay: bill.autopay,
    recurring: bill.recurring,
    status,
    statusLabel: STATUS_LABELS[status],
    paycheckAssignment: split.paycheckAssignment,
    paymentAccountId: split.paymentAccountId,
    splitCount: splits.length,
  };
}

export function enrichBill(
  bill: Bill,
  referenceDate = new Date(),
): BillProgress {
  const split = getEffectiveBillSplits(bill)[0];
  return enrichBillSplit(bill, split, referenceDate);
}

function billStartDateFromDueDay(dueDay: number, referenceDate: Date): Date {
  if (dueDay <= 0) {
    return startOfDay(referenceDate);
  }

  return new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    Math.min(dueDay, 28),
  );
}

export function buildUpdatedBill(
  existing: Bill,
  input: EditBillInput,
  referenceDate = new Date(),
): Bill {
  const frequency = normalizeBillFrequency(
    input.frequency ?? existing.frequency ?? "monthly",
  );
  const status = input.recurring ? ("active" as const) : ("paused" as const);
  const primarySplit = input.splits?.[0];
  const dueDay = primarySplit?.dueDay ?? input.dueDay;
  const startDate = input.startDate
    ? parseDateString(input.startDate)
    : existing.schedule
      ? parseDateString(existing.schedule.startDate)
      : billStartDateFromDueDay(dueDay, referenceDate);

  let schedule = existing.schedule;

  if (
    !schedule ||
    frequency !== normalizeBillFrequency(existing.frequency ?? "monthly") ||
    input.startDate ||
    schedule.status !== status
  ) {
    schedule = createSchedule(startDate, frequency, referenceDate, status);
  } else {
    schedule = {
      ...schedule,
      frequency,
      status,
    };
  }

  return {
    ...existing,
    name: input.name.trim(),
    amount: input.amount,
    dueDay,
    autopay: input.autopay,
    recurring: input.recurring,
    category: input.category.trim(),
    frequency,
    schedule,
    paycheckAssignment:
      primarySplit?.paycheckAssignment ??
      input.paycheckAssignment ??
      "first_paycheck",
    customPayDay: primarySplit?.customPayDay ?? input.customPayDay ?? null,
    paymentAccountId:
      primarySplit?.paymentAccountId ?? input.paymentAccountId ?? null,
    splits:
      input.splits?.map((split, index) => ({
        id: split.id ?? crypto.randomUUID(),
        billId: existing.id,
        amount: split.amount,
        dueDay: split.dueDay,
        paycheckAssignment: split.paycheckAssignment ?? "first_paycheck",
        customPayDay: split.customPayDay ?? null,
        paymentAccountId: split.paymentAccountId ?? null,
        paidMonth:
          (existing.splits ?? []).find((item) => item.id === split.id)?.paidMonth ??
          null,
        paidAmount:
          (existing.splits ?? []).find((item) => item.id === split.id)?.paidAmount ??
          0,
        sortOrder: split.sortOrder ?? index,
      })) ?? (existing.splits ?? []),
  };
}

export function getBillProgressList(
  data: FinanceData,
  referenceDate = new Date(),
): BillProgress[] {
  return (data.bills ?? []).flatMap((bill) =>
    getEffectiveBillSplits(bill).map((split) =>
      enrichBillSplit(bill, split, referenceDate),
    ),
  );
}

export function getMonthlyBills(
  data: FinanceData,
  referenceDate = new Date(),
): BillProgress[] {
  return getBillProgressList(data, referenceDate).filter(
    (bill) => bill.recurring,
  );
}

export function getUpcomingBills(
  data: FinanceData,
  referenceDate = new Date(),
): BillProgress[] {
  return getBillProgressList(data, referenceDate)
    .filter((bill) => bill.status !== "paid")
    .sort((left, right) => {
      const statusOrder: Record<BillStatus, number> = {
        overdue: 0,
        due_today: 1,
        due_soon: 2,
        partial: 2,
        upcoming: 3,
        paid: 4,
      };

      if (statusOrder[left.status] !== statusOrder[right.status]) {
        return statusOrder[left.status] - statusOrder[right.status];
      }

      if (!left.dueDate && !right.dueDate) {
        return left.name.localeCompare(right.name);
      }

      if (!left.dueDate) return 1;
      if (!right.dueDate) return -1;

      return left.dueDate.getTime() - right.dueDate.getTime();
    });
}

export function getPaidBills(
  data: FinanceData,
  referenceDate = new Date(),
): BillProgress[] {
  return getBillProgressList(data, referenceDate)
    .filter((bill) => bill.status === "paid")
    .sort((left, right) => left.name.localeCompare(right.name));
}

function daysUntil(date: Date, referenceDate: Date): number {
  const today = startOfDay(referenceDate);
  const target = startOfDay(date);
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
}

export function getBillsDueThisWeek(
  data: FinanceData,
  referenceDate = new Date(),
): BillProgress[] {
  return getBillProgressList(data, referenceDate).filter((bill) => {
    if (bill.status === "paid" || !bill.dueDate) {
      return false;
    }

    if (bill.status === "overdue" || bill.status === "due_today") {
      return true;
    }

    const days = daysUntil(bill.dueDate, referenceDate);
    return days >= 0 && days <= 7;
  });
}

export function getBillsDueTomorrow(
  data: FinanceData,
  referenceDate = new Date(),
): BillProgress[] {
  return getBillProgressList(data, referenceDate).filter((bill) => {
    if (bill.status === "paid" || !bill.dueDate) {
      return false;
    }

    return daysUntil(bill.dueDate, referenceDate) === 1;
  });
}

export function getNextBillDue(
  data: FinanceData,
  referenceDate = new Date(),
): BillProgress | null {
  const candidates = getBillProgressList(data, referenceDate).filter(
    (bill) => bill.status !== "paid" && bill.dueDate,
  );

  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    if (left.status === "overdue" && right.status !== "overdue") {
      return -1;
    }

    if (right.status === "overdue" && left.status !== "overdue") {
      return 1;
    }

    if (left.status === "due_today" && right.status !== "due_today") {
      return -1;
    }

    if (right.status === "due_today" && left.status !== "due_today") {
      return 1;
    }

    if (!left.dueDate || !right.dueDate) {
      return 0;
    }

    return left.dueDate.getTime() - right.dueDate.getTime();
  })[0];
}

export function getTotalMonthlyBills(data: FinanceData): number {
  return (data.bills ?? [])
    .filter((bill) => bill.recurring)
    .reduce(
      (total, bill) =>
        total + toMonthlyAmount(bill.amount, bill.frequency ?? "monthly"),
      0,
    );
}

function getTotalCashBalance(data: FinanceData): number {
  return (data.accounts ?? [])
    .filter((account) => isCashAccountType(account.type))
    .reduce((total, account) => total + account.balance, 0);
}

export function getBillsDashboardSummary(
  data: FinanceData,
  referenceDate = new Date(),
): BillsDashboardSummary {
  const dueThisWeek = getBillsDueThisWeek(data, referenceDate);
  const nextBill = getNextBillDue(data, referenceDate);
  const totalMonthlyBills = getTotalMonthlyBills(data);
  const dueThisWeekAmount = dueThisWeek.reduce(
    (total, bill) => total + bill.remainingAmount,
    0,
  );

  return {
    dueThisWeekCount: dueThisWeek.length,
    dueThisWeekAmount,
    totalMonthlyBills,
    nextBill: nextBill
      ? {
          id: nextBill.splitId,
          name: nextBill.name,
          amount: nextBill.amount,
          dueDate: nextBill.formattedDueDate,
          daysUntilDue: nextBill.dueDate
            ? daysUntil(nextBill.dueDate, referenceDate)
            : 0,
          status: nextBill.status,
        }
      : null,
    monthlyCashRemaining:
      calculateMonthlyIncome(data, referenceDate) -
      calculateMonthlySpending(data, referenceDate),
    safeToSpendAfterUpcomingBills: getSafeToSpend(data, referenceDate),
  };
}

export function getBillStatusVariant(
  status: BillStatus,
): "default" | "accent" | "success" | "warning" | "danger" {
  switch (status) {
    case "partial":
      return "warning";
    case "paid":
      return "success";
    case "due_today":
      return "accent";
    case "due_soon":
      return "warning";
    case "overdue":
      return "danger";
    default:
      return "default";
  }
}

export function findBillSplit(
  data: FinanceData,
  billId: string,
  splitId: string,
): { bill: Bill; split: BillSplit } | null {
  const bill = data.bills.find((item) => item.id === billId);

  if (!bill) {
    return null;
  }

  const split = getEffectiveBillSplits(bill).find((item) => item.id === splitId);

  if (!split) {
    return null;
  }

  return { bill, split };
}
