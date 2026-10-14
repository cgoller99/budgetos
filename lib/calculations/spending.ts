import type { FinanceData } from "@/lib/finance/types";
import { toMonthlyAmount } from "@/lib/calculations/monthlyAmount";
import { getBillProgressList, getCurrentYearMonth } from "@/lib/finance/bills";
import { getTransactionsForMonth } from "@/lib/transactions";
import { isRefundActivity } from "@/lib/transactions/refunds";
import { isInternalTransferExpense } from "@/lib/transactions/transferDetection";
import { startOfDay } from "@/lib/recurring/schedule";

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function normalizeMerchant(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function recurringBillMonthlyTotal(data: FinanceData): number {
  return sum(
    (data.bills ?? [])
      .filter((bill) => bill.recurring)
      .map((bill) => toMonthlyAmount(bill.amount, bill.frequency ?? "monthly")),
  );
}

/**
 * Unpaid one-time bills due in the reference month.
 * Shared with Money Flow / Safe to Spend so outlook and monthly STS agree.
 * Excludes paid/cancelled (via progress status) and bills already covered by
 * a recurring schedule for the same bill id.
 */
function oneTimeBillObligationsForMonth(
  data: FinanceData,
  referenceDate = new Date(),
): number {
  const monthKey = getCurrentYearMonth(referenceDate);
  const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const monthEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);

  return sum(
    getBillProgressList(data, referenceDate)
      .filter((progress) => {
        if (progress.recurring) {
          return false;
        }
        if (progress.status === "paid" || progress.remainingAmount <= 0) {
          return false;
        }
        if (!progress.dueDate) {
          return false;
        }
        const due = startOfDay(progress.dueDate);
        if (due.getTime() < monthStart.getTime() || due.getTime() > monthEnd.getTime()) {
          return false;
        }
        // Guard against duplicate split rows for the same one-time bill.
        return getCurrentYearMonth(due) === monthKey;
      })
      .map((progress) => progress.remainingAmount),
  );
}

function matchesRecurringBill(params: {
  billName: string;
  billAmount: number;
  transactionNotes: string;
  transactionAmount: number;
}): boolean {
  const billName = normalizeMerchant(params.billName);
  const notes = normalizeMerchant(params.transactionNotes);

  if (!billName || !notes) {
    return false;
  }

  const nameMatch =
    notes.includes(billName) ||
    billName.includes(notes) ||
    billName.split(" ")[0]?.length >= 4 && notes.includes(billName.split(" ")[0] ?? "");

  if (!nameMatch) {
    return false;
  }

  const tolerance = Math.max(params.billAmount * 0.05, 1);
  return Math.abs(params.transactionAmount - params.billAmount) <= tolerance;
}

/**
 * Refunds already stored as income are not expenses, so subtract them once.
 * Negative expense amounts already reduce the expense sum.
 */
function incomeRefundOffset(data: FinanceData, referenceDate: Date): number {
  return getTransactionsForMonth(data, referenceDate)
    .filter(
      (transaction) =>
        transaction.type === "income" && isRefundActivity(transaction),
    )
    .reduce((total, transaction) => total + Math.abs(transaction.amount), 0);
}

function getCurrentMonthExpenseTransactions(
  data: FinanceData,
  referenceDate = new Date(),
  options?: { excludeDebtLinked?: boolean },
) {
  return getTransactionsForMonth(data, referenceDate).filter(
    (transaction) =>
      transaction.type === "expense" &&
      !transaction.goalId &&
      !isInternalTransferExpense(data, transaction) &&
      !(options?.excludeDebtLinked && transaction.debtId),
  );
}

function sumBillLinkedExpenses(
  data: FinanceData,
  referenceDate = new Date(),
): number {
  return sum(
    getCurrentMonthExpenseTransactions(data, referenceDate, { excludeDebtLinked: true })
      .filter((transaction) => Boolean(transaction.billId))
      .map((transaction) => transaction.amount),
  );
}

function sumBillMatchedExpenses(
  data: FinanceData,
  referenceDate = new Date(),
): number {
  const recurringBills = (data.bills ?? []).filter((bill) => bill.recurring);
  const expenses = getCurrentMonthExpenseTransactions(data, referenceDate, {
    excludeDebtLinked: true,
  }).filter((transaction) => !transaction.billId);

  let matchedTotal = 0;
  const matchedExpenseIds = new Set<string>();

  for (const bill of recurringBills) {
    for (const transaction of expenses) {
      if (matchedExpenseIds.has(transaction.id)) {
        continue;
      }

      if (
        matchesRecurringBill({
          billName: bill.name,
          billAmount: bill.amount,
          transactionNotes: transaction.notes ?? transaction.category ?? "",
          transactionAmount: transaction.amount,
        })
      ) {
        matchedExpenseIds.add(transaction.id);
        matchedTotal += transaction.amount;
      }
    }
  }

  return matchedTotal;
}

function sumDiscretionaryExpenses(
  data: FinanceData,
  referenceDate = new Date(),
): number {
  const expenses = getCurrentMonthExpenseTransactions(data, referenceDate, {
    excludeDebtLinked: true,
  });
  const matchedIds = new Set<string>();

  for (const transaction of expenses) {
    if (transaction.billId) {
      matchedIds.add(transaction.id);
    }
  }

  for (const bill of (data.bills ?? []).filter((item) => item.recurring)) {
    for (const transaction of expenses) {
      if (matchedIds.has(transaction.id)) {
        continue;
      }

      if (
        matchesRecurringBill({
          billName: bill.name,
          billAmount: bill.amount,
          transactionNotes: transaction.notes ?? transaction.category ?? "",
          transactionAmount: transaction.amount,
        })
      ) {
        matchedIds.add(transaction.id);
      }
    }
  }

  return sum(
    expenses
      .filter((transaction) => !matchedIds.has(transaction.id))
      .map((transaction) => transaction.amount),
  );
}

/**
 * Canonical monthly spending for Money Flow / Safe To Spend.
 * Avoids double-counting recurring bills that already appear as Plaid expenses.
 * Includes unpaid one-time bills due this month (same obligation basis as the
 * 30-day outlook for the current month).
 */
export function calculateMonthlySpendingForMoneyFlow(
  data: FinanceData,
  referenceDate = new Date(),
): number {
  const recurringBills = recurringBillMonthlyTotal(data);
  const oneTimeBills = oneTimeBillObligationsForMonth(data, referenceDate);
  const refundOffset = incomeRefundOffset(data, referenceDate);
  const ledgerExpenses = sum(
    getCurrentMonthExpenseTransactions(data, referenceDate, {
      excludeDebtLinked: true,
    }).map((transaction) => transaction.amount),
  );

  if (recurringBills <= 0 && oneTimeBills <= 0) {
    return ledgerExpenses - refundOffset;
  }

  // Discretionary excludes billId-linked and name-matched recurring expenses.
  // One-time remaining amounts come from bill progress (payment-aware).
  const discretionary = sumDiscretionaryExpenses(data, referenceDate);
  return recurringBills + oneTimeBills + discretionary - refundOffset;
}

/**
 * Ledger-only spending for Reports charts (actual transactions).
 */
export function calculateMonthlySpendingFromLedger(
  data: FinanceData,
  referenceDate = new Date(),
): number {
  return (
    sum(
      getCurrentMonthExpenseTransactions(data, referenceDate).map(
        (transaction) => transaction.amount,
      ),
    ) - incomeRefundOffset(data, referenceDate)
  );
}

export {
  recurringBillMonthlyTotal,
  oneTimeBillObligationsForMonth,
  sumBillLinkedExpenses,
  sumBillMatchedExpenses,
  sumDiscretionaryExpenses,
};
