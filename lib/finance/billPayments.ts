import { getCurrentYearMonth } from "@/lib/finance/bills";
import {
  getCurrentBillingCycle,
  isDateInCycleWindow,
} from "@/lib/bills/billingCycles";
import type { BillSplit, FinanceData, Transaction } from "@/lib/finance/types";

export type BillPaymentContext = {
  billId?: string;
  transactions?: Transaction[];
};

function getCycleMonth(referenceDate: Date): string {
  return getCurrentYearMonth(referenceDate);
}

function sumLinkedCyclePayments(
  billId: string,
  cycleMonth: string,
  split: BillSplit,
  transactions: Transaction[],
  referenceDate: Date,
): number {
  const cycle = getCurrentBillingCycle(
    { id: billId, dueDay: split.dueDay } as FinanceData["bills"][number],
    referenceDate,
  );

  if (!cycle || cycle.cycleMonth !== cycleMonth) {
    return transactions
      .filter(
        (transaction) =>
          transaction.billId === billId &&
          transaction.type === "expense" &&
          transaction.amount > 0,
      )
      .filter((transaction) => {
        const month = transaction.date.slice(0, 7);
        return month === cycleMonth;
      })
      .reduce((total, transaction) => total + transaction.amount, 0);
  }

  return transactions
    .filter(
      (transaction) =>
        transaction.billId === billId &&
        transaction.type === "expense" &&
        transaction.amount > 0 &&
        isDateInCycleWindow(transaction.date, cycle),
    )
    .reduce((total, transaction) => total + transaction.amount, 0);
}

export function getSplitPaidAmount(
  split: BillSplit,
  referenceDate = new Date(),
  context?: BillPaymentContext,
): number {
  const cycleMonth = getCycleMonth(referenceDate);
  let recorded = 0;

  if (split.paidMonth === cycleMonth) {
    recorded = Math.max(0, split.paidAmount ?? 0);
  }

  if (!context?.billId || !context.transactions?.length) {
    return recorded;
  }

  const linked = sumLinkedCyclePayments(
    context.billId,
    cycleMonth,
    split,
    context.transactions,
    referenceDate,
  );

  return Math.max(recorded, linked);
}

export function getSplitRemainingAmount(
  split: BillSplit,
  referenceDate = new Date(),
  context?: BillPaymentContext,
): number {
  return Math.max(
    0,
    split.amount - getSplitPaidAmount(split, referenceDate, context),
  );
}

export function isSplitFullyPaid(
  split: BillSplit,
  referenceDate = new Date(),
  context?: BillPaymentContext,
): boolean {
  return getSplitRemainingAmount(split, referenceDate, context) <= 0;
}

export type BillPaymentRecord = {
  id: string;
  billId: string;
  amount: number;
  date: string;
  category: string;
  notes: string;
  accountId: string;
};

export function getBillPaymentHistory(
  data: FinanceData,
  billId: string,
): BillPaymentRecord[] {
  return (data.transactions ?? [])
    .filter(
      (transaction): transaction is Transaction =>
        transaction.type === "expense" && transaction.billId === billId,
    )
    .sort((left, right) => right.date.localeCompare(left.date))
    .map((transaction) => ({
      id: transaction.id,
      billId,
      amount: transaction.amount,
      date: transaction.date,
      category: transaction.category,
      notes: transaction.notes,
      accountId: transaction.accountId,
    }));
}
