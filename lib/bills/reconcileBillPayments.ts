import {
  buildMonthlyCyclesForBill,
  cycleIsPaidFromSchedule,
  getCurrentBillingCycle,
  isDateInCycleWindow,
  markSchedulePaidForCycle,
  type BillingCycle,
} from "@/lib/bills/billingCycles";
import {
  amountsMatch,
  scoreMerchantMatch,
  transactionLabel,
} from "@/lib/bills/merchantMatch";
import { getCurrentYearMonth } from "@/lib/finance/bills";
import { getEffectiveBillSplits } from "@/lib/finance/billSplits";
import type { Bill, BillSplit, FinanceData, Transaction } from "@/lib/finance/types";
import { computeInitialNextOccurrence } from "@/lib/recurring/schedule";

export type BillMatchCandidate = {
  transactionId: string;
  transactionDate: string;
  transactionAmount: number;
  merchantLabel: string;
  score: number;
  merchantReason: string;
  amountMatch: boolean;
  dateInWindow: boolean;
  accepted: boolean;
  rejectReason?: string;
};

export type BillCycleDiagnostic = {
  billId: string;
  billName: string;
  cycleMonth: string;
  dueDate: string;
  amount: number;
  statusBefore: "unpaid" | "paid";
  statusAfter: "unpaid" | "paid";
  matchedTransactionId: string | null;
  candidates: BillMatchCandidate[];
};

export type BillReconcileLink = {
  transactionId: string;
  billId: string;
  splitId: string | null;
  cycleMonth: string;
  amount: number;
};

export type BillReconcileResult = {
  linksApplied: BillReconcileLink[];
  billsUpdated: string[];
  transactionsLinked: number;
  cyclesMarkedPaid: number;
};

export type BillReconcileOptions = {
  referenceDate?: Date;
  lookbackMonths?: number;
  /** When true, only produce diagnostics without mutating data. */
  dryRun?: boolean;
};

const MIN_MERCHANT_SCORE = 65;

function isEligiblePaymentTransaction(transaction: Transaction): boolean {
  return (
    transaction.type === "expense" &&
    transaction.amount > 0 &&
    !transaction.goalId &&
    !transaction.debtId
  );
}

function getBillAmountForCycle(bill: Bill, split: BillSplit): number {
  return split.amount > 0 ? split.amount : bill.amount;
}

function splitCycleIsPaid(
  split: BillSplit,
  cycle: BillingCycle,
  billId: string,
  transactions: Transaction[],
): boolean {
  if (split.paidMonth === cycle.cycleMonth) {
    const paidAmount = split.paidAmount ?? 0;
    if (paidAmount >= split.amount) {
      return true;
    }
  }

  const linkedTotal = transactions
    .filter(
      (transaction) =>
        transaction.billId === billId &&
        isEligiblePaymentTransaction(transaction) &&
        isDateInCycleWindow(transaction.date, cycle),
    )
    .reduce((total, transaction) => total + transaction.amount, 0);

  return linkedTotal >= split.amount;
}

function scoreTransactionForCycle(params: {
  bill: Bill;
  split: BillSplit;
  cycle: BillingCycle;
  transaction: Transaction;
  alreadyLinkedBillId: string | null;
}): BillMatchCandidate {
  const { bill, split, cycle, transaction, alreadyLinkedBillId } = params;
  const label = transactionLabel(transaction);
  const merchant = scoreMerchantMatch(bill.name, label);
  const amountMatch = amountsMatch(
    getBillAmountForCycle(bill, split),
    transaction.amount,
  );
  const dateInWindow = isDateInCycleWindow(transaction.date, cycle);

  let accepted = false;
  let rejectReason: string | undefined;

  if (alreadyLinkedBillId && alreadyLinkedBillId !== bill.id) {
    rejectReason = "transaction_linked_to_other_bill";
  } else if (!merchant.match || merchant.score < MIN_MERCHANT_SCORE) {
    rejectReason = merchant.reason;
  } else if (!amountMatch) {
    rejectReason = "amount_outside_tolerance";
  } else if (!dateInWindow) {
    rejectReason = "date_outside_cycle_window";
  } else {
    accepted = true;
  }

  return {
    transactionId: transaction.id,
    transactionDate: transaction.date,
    transactionAmount: transaction.amount,
    merchantLabel: label,
    score: merchant.score,
    merchantReason: merchant.reason,
    amountMatch,
    dateInWindow,
    accepted,
    rejectReason,
  };
}

function pickBestCandidate(
  candidates: BillMatchCandidate[],
): BillMatchCandidate | null {
  const accepted = candidates.filter((candidate) => candidate.accepted);
  if (accepted.length === 0) {
    return null;
  }

  return [...accepted].sort((left, right) => right.score - left.score)[0] ?? null;
}

function applySplitCyclePayment(
  bill: Bill,
  split: BillSplit,
  cycle: BillingCycle,
  paymentAmount: number,
): Bill {
  const hasStoredSplits = (bill.splits ?? []).length > 0;
  const paidAmount = Math.max(split.paidAmount ?? 0, paymentAmount);

  if (hasStoredSplits) {
    const updatedSplits = (bill.splits ?? []).map((item) =>
      item.id === split.id
        ? {
            ...item,
            paidMonth: cycle.cycleMonth,
            paidAmount,
          }
        : item,
    );

    return {
      ...bill,
      paidMonth: cycle.cycleMonth,
      splits: updatedSplits,
    };
  }

  return {
    ...bill,
    paidMonth: cycle.cycleMonth,
  };
}

function catchUpScheduleAfterPayments(
  bill: Bill,
  referenceDate: Date,
): Bill {
  if (!bill.schedule) {
    return bill;
  }

  const next = computeInitialNextOccurrence(
    bill.schedule.nextOccurrence
      ? new Date(`${bill.schedule.nextOccurrence}T12:00:00`)
      : new Date(`${bill.schedule.startDate}T12:00:00`),
    bill.schedule.frequency,
    referenceDate,
  );

  return {
    ...bill,
    schedule: {
      ...bill.schedule,
      nextOccurrence: next.toISOString().slice(0, 10),
    },
  };
}

function linkTransactionToBill(
  transactions: Transaction[],
  transactionId: string,
  billId: string,
): Transaction[] {
  return transactions.map((transaction) =>
    transaction.id === transactionId
      ? { ...transaction, billId }
      : transaction,
  );
}

export function diagnoseBillPaymentMatching(
  data: FinanceData,
  options: BillReconcileOptions = {},
): BillCycleDiagnostic[] {
  const referenceDate = options.referenceDate ?? new Date();
  const lookbackMonths = options.lookbackMonths ?? 24;
  const transactions = data.transactions ?? [];
  const diagnostics: BillCycleDiagnostic[] = [];

  for (const bill of data.bills ?? []) {
    if (!bill.recurring) {
      continue;
    }

    const splits = getEffectiveBillSplits(bill);
    const cycles = buildMonthlyCyclesForBill(bill, referenceDate, lookbackMonths);

    for (const split of splits) {
      for (const cycle of cycles) {
        const paidBefore =
          splitCycleIsPaid(split, cycle, bill.id, transactions) ||
          cycleIsPaidFromSchedule(bill, cycle);

        const candidates = transactions
          .filter(isEligiblePaymentTransaction)
          .map((transaction) =>
            scoreTransactionForCycle({
              bill,
              split,
              cycle,
              transaction,
              alreadyLinkedBillId: transaction.billId ?? null,
            }),
          )
          .sort((left, right) => right.score - left.score)
          .slice(0, 8);

        const best = pickBestCandidate(candidates);
        const paidAfter = paidBefore || Boolean(best);

        diagnostics.push({
          billId: bill.id,
          billName: bill.name,
          cycleMonth: cycle.cycleMonth,
          dueDate: cycle.dueDate.toISOString().slice(0, 10),
          amount: getBillAmountForCycle(bill, split),
          statusBefore: paidBefore ? "paid" : "unpaid",
          statusAfter: paidAfter ? "paid" : "unpaid",
          matchedTransactionId: best?.transactionId ?? null,
          candidates,
        });
      }
    }
  }

  return diagnostics;
}

export function reconcileBillPayments(
  data: FinanceData,
  options: BillReconcileOptions = {},
): { data: FinanceData; result: BillReconcileResult; diagnostics: BillCycleDiagnostic[] } {
  const referenceDate = options.referenceDate ?? new Date();
  const lookbackMonths = options.lookbackMonths ?? 24;
  const dryRun = options.dryRun ?? false;

  let nextData: FinanceData = {
    ...data,
    transactions: [...(data.transactions ?? [])],
    bills: [...(data.bills ?? [])],
  };

  const linksApplied: BillReconcileLink[] = [];
  const billsUpdated = new Set<string>();
  const usedTransactionIds = new Set<string>(
    (data.transactions ?? [])
      .filter((transaction) => Boolean(transaction.billId))
      .map((transaction) => transaction.id),
  );

  for (const bill of data.bills ?? []) {
    if (!bill.recurring) {
      continue;
    }

    let updatedBill = nextData.bills.find((item) => item.id === bill.id) ?? bill;
    const splits = getEffectiveBillSplits(updatedBill);
    const cycles = buildMonthlyCyclesForBill(updatedBill, referenceDate, lookbackMonths);

    for (const split of splits) {
      for (const cycle of cycles) {
        const alreadyPaid = splitCycleIsPaid(
          split,
          cycle,
          updatedBill.id,
          nextData.transactions ?? [],
        );

        if (alreadyPaid || cycleIsPaidFromSchedule(updatedBill, cycle)) {
          continue;
        }

        const candidates = (nextData.transactions ?? [])
          .filter(
            (transaction) =>
              isEligiblePaymentTransaction(transaction) &&
              !usedTransactionIds.has(transaction.id),
          )
          .map((transaction) =>
            scoreTransactionForCycle({
              bill: updatedBill,
              split,
              cycle,
              transaction,
              alreadyLinkedBillId: transaction.billId ?? null,
            }),
          );

        const best = pickBestCandidate(candidates);
        if (!best) {
          continue;
        }

        if (dryRun) {
          continue;
        }

        nextData = {
          ...nextData,
          transactions: linkTransactionToBill(
            nextData.transactions ?? [],
            best.transactionId,
            updatedBill.id,
          ),
        };
        usedTransactionIds.add(best.transactionId);

        updatedBill = applySplitCyclePayment(
          updatedBill,
          split,
          cycle,
          best.transactionAmount,
        );

        if (updatedBill.schedule) {
          updatedBill = markSchedulePaidForCycle(updatedBill, cycle);
        }

        split.paidMonth = cycle.cycleMonth;
        split.paidAmount = Math.max(split.paidAmount ?? 0, best.transactionAmount);

        linksApplied.push({
          transactionId: best.transactionId,
          billId: updatedBill.id,
          splitId: split.id,
          cycleMonth: cycle.cycleMonth,
          amount: best.transactionAmount,
        });
        billsUpdated.add(updatedBill.id);
      }
    }

    if (updatedBill.schedule) {
      updatedBill = catchUpScheduleAfterPayments(updatedBill, referenceDate);
    }

    if (billsUpdated.has(updatedBill.id)) {
      nextData = {
        ...nextData,
        bills: nextData.bills.map((item) =>
          item.id === updatedBill.id ? updatedBill : item,
        ),
      };
    }
  }

  const diagnostics = diagnoseBillPaymentMatching(nextData, {
    referenceDate,
    lookbackMonths,
  });

  return {
    data: nextData,
    result: {
      linksApplied,
      billsUpdated: [...billsUpdated],
      transactionsLinked: linksApplied.length,
      cyclesMarkedPaid: linksApplied.length,
    },
    diagnostics,
  };
}

export function getOverdueBillDiagnostics(
  data: FinanceData,
  referenceDate = new Date(),
): Array<{
  billId: string;
  billName: string;
  splitId: string;
  dueDate: string | null;
  amount: number;
  cycleMonth: string;
  linkedPaymentTotal: number;
  unpaidReason: string;
}> {
  const currentMonth = getCurrentYearMonth(referenceDate);
  const items: Array<{
    billId: string;
    billName: string;
    splitId: string;
    dueDate: string | null;
    amount: number;
    cycleMonth: string;
    linkedPaymentTotal: number;
    unpaidReason: string;
  }> = [];

  for (const bill of data.bills ?? []) {
    const splits = getEffectiveBillSplits(bill);
    const cycle = getCurrentBillingCycle(bill, referenceDate);
    if (!cycle) continue;

    for (const split of splits) {
      const linkedPaymentTotal = (data.transactions ?? [])
        .filter(
          (transaction) =>
            transaction.billId === bill.id &&
            isEligiblePaymentTransaction(transaction) &&
            isDateInCycleWindow(transaction.date, cycle),
        )
        .reduce((total, transaction) => total + transaction.amount, 0);

      const paid =
        splitCycleIsPaid(split, cycle, bill.id, data.transactions ?? []) ||
        cycleIsPaidFromSchedule(bill, cycle);

      if (!paid && cycle.cycleMonth <= currentMonth) {
        items.push({
          billId: bill.id,
          billName: bill.name,
          splitId: split.id,
          dueDate: cycle.dueDate.toISOString().slice(0, 10),
          amount: getBillAmountForCycle(bill, split),
          cycleMonth: cycle.cycleMonth,
          linkedPaymentTotal,
          unpaidReason:
            linkedPaymentTotal > 0
              ? "partial_payment_below_bill_amount"
              : "no_matching_payment_linked",
        });
      }
    }
  }

  return items;
}
