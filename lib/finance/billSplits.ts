import { getCurrentYearMonth, getDueDateForMonth, startOfDay } from "@/lib/finance/bills";
import {
  getSplitPaidAmount,
  getSplitRemainingAmount,
  isSplitFullyPaid,
  type BillPaymentContext,
} from "@/lib/finance/billPayments";
import type { Bill, BillSplit, BillSplitInput, BillStatus } from "@/lib/finance/types";
import { normalizePaycheckAssignment } from "@/lib/finance/paycheckSplit";

const MS_PER_DAY = 86_400_000;
const DUE_SOON_DAYS = 3;

export function createSyntheticBillSplit(bill: Bill): BillSplit {
  return {
    id: `${bill.id}-legacy`,
    billId: bill.id,
    amount: bill.amount,
    dueDay: bill.dueDay,
    paycheckAssignment: bill.paycheckAssignment ?? "first_paycheck",
    customPayDay: bill.customPayDay ?? null,
    paymentAccountId: bill.paymentAccountId ?? null,
    paidMonth: bill.paidMonth,
    paidAmount: bill.paidMonth ? bill.amount : 0,
    sortOrder: 0,
  };
}

export function getEffectiveBillSplits(bill: Bill): BillSplit[] {
  const storedSplits = bill.splits ?? [];

  if (storedSplits.length > 0) {
    return [...storedSplits].sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.dueDay - right.dueDay,
    );
  }

  return [createSyntheticBillSplit(bill)];
}

export function getSplitDueDate(
  split: BillSplit,
  referenceDate: Date,
): Date | null {
  return getDueDateForMonth(split.dueDay, referenceDate);
}

export function getSplitStatus(
  split: BillSplit,
  referenceDate = new Date(),
  context?: BillPaymentContext,
): BillStatus {
  const paidAmount = getSplitPaidAmount(split, referenceDate, context);
  const remaining = getSplitRemainingAmount(split, referenceDate, context);

  if (remaining <= 0 && paidAmount > 0) {
    return "paid";
  }

  if (paidAmount > 0 && remaining > 0) {
    return "partial";
  }

  if (split.dueDay <= 0) {
    return "upcoming";
  }

  const dueDate = getSplitDueDate(split, referenceDate);

  if (!dueDate) {
    return "upcoming";
  }

  const today = startOfDay(referenceDate);
  const due = startOfDay(dueDate);

  if (today.getTime() === due.getTime()) {
    return "due_today";
  }

  if (today > due) {
    return "overdue";
  }

  const daysUntilDue = Math.ceil((due.getTime() - today.getTime()) / MS_PER_DAY);

  if (daysUntilDue <= DUE_SOON_DAYS) {
    return "due_soon";
  }

  return "upcoming";
}

export function areAllSplitsPaid(
  bill: Bill,
  referenceDate = new Date(),
  context?: BillPaymentContext,
): boolean {
  const paymentContext = context ?? { billId: bill.id };
  return getEffectiveBillSplits(bill).every((split) =>
    isSplitFullyPaid(split, referenceDate, paymentContext),
  );
}

export function syncBillPaidMonth(
  bill: Bill,
  referenceDate = new Date(),
): string | null {
  return areAllSplitsPaid(bill, referenceDate)
    ? getCurrentYearMonth(referenceDate)
    : null;
}

export function getSplitDisplayName(
  billName: string,
  split: BillSplit,
  splitCount: number,
): string {
  if (splitCount <= 1) {
    return billName;
  }

  if (split.dueDay <= 0) {
    return `${billName} · split`;
  }

  return `${billName} · due ${split.dueDay}${ordinalSuffix(split.dueDay)}`;
}

function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) {
    return "th";
  }

  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

export function normalizeBillSplitInputs(
  splits: BillSplitInput[] | undefined,
  fallback: BillSplitInput,
): BillSplitInput[] {
  const normalized = (splits ?? [fallback]).map((split, index) => ({
    id: split.id,
    amount: split.amount,
    dueDay: split.dueDay,
    paycheckAssignment: normalizePaycheckAssignment(split.paycheckAssignment),
    customPayDay: split.customPayDay ?? null,
    paymentAccountId: split.paymentAccountId ?? null,
    sortOrder: split.sortOrder ?? index,
  }));

  return normalized.length > 0 ? normalized : [fallback];
}

export function billAmountFromSplits(splits: BillSplitInput[]): number {
  return splits.reduce((total, split) => total + split.amount, 0);
}
