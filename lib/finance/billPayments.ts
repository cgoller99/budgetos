import { getCurrentYearMonth } from "@/lib/finance/bills";
import type { BillSplit, FinanceData, Transaction } from "@/lib/finance/types";

export function getSplitPaidAmount(
  split: BillSplit,
  referenceDate = new Date(),
): number {
  const currentMonth = getCurrentYearMonth(referenceDate);

  if (split.paidMonth !== currentMonth) {
    return 0;
  }

  return Math.max(0, split.paidAmount ?? 0);
}

export function getSplitRemainingAmount(
  split: BillSplit,
  referenceDate = new Date(),
): number {
  return Math.max(0, split.amount - getSplitPaidAmount(split, referenceDate));
}

export function isSplitFullyPaid(
  split: BillSplit,
  referenceDate = new Date(),
): boolean {
  return getSplitRemainingAmount(split, referenceDate) <= 0;
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
