import type { FinanceData } from "@/lib/finance/types";
import { toMonthlyAmount } from "@/lib/calculations/monthlyAmount";
import { getTransactionsForMonth } from "@/lib/transactions";

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

function getCurrentMonthExpenseTransactions(
  data: FinanceData,
  referenceDate = new Date(),
) {
  return getTransactionsForMonth(data, referenceDate).filter(
    (transaction) => transaction.type === "expense" && !transaction.goalId,
  );
}

function sumBillLinkedExpenses(
  data: FinanceData,
  referenceDate = new Date(),
): number {
  return sum(
    getCurrentMonthExpenseTransactions(data, referenceDate)
      .filter((transaction) => Boolean(transaction.billId))
      .map((transaction) => transaction.amount),
  );
}

function sumBillMatchedExpenses(
  data: FinanceData,
  referenceDate = new Date(),
): number {
  const recurringBills = (data.bills ?? []).filter((bill) => bill.recurring);
  const expenses = getCurrentMonthExpenseTransactions(data, referenceDate).filter(
    (transaction) => !transaction.billId,
  );

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
  const expenses = getCurrentMonthExpenseTransactions(data, referenceDate);
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
 */
export function calculateMonthlySpendingForMoneyFlow(
  data: FinanceData,
  referenceDate = new Date(),
): number {
  const recurringBills = recurringBillMonthlyTotal(data);
  const ledgerExpenses = sum(
    getCurrentMonthExpenseTransactions(data, referenceDate).map(
      (transaction) => transaction.amount,
    ),
  );

  if (recurringBills <= 0) {
    return ledgerExpenses;
  }

  const discretionary = sumDiscretionaryExpenses(data, referenceDate);
  return recurringBills + discretionary;
}

/**
 * Ledger-only spending for Reports charts (actual transactions).
 */
export function calculateMonthlySpendingFromLedger(
  data: FinanceData,
  referenceDate = new Date(),
): number {
  return sum(
    getCurrentMonthExpenseTransactions(data, referenceDate).map(
      (transaction) => transaction.amount,
    ),
  );
}

export {
  recurringBillMonthlyTotal,
  sumBillLinkedExpenses,
  sumBillMatchedExpenses,
  sumDiscretionaryExpenses,
};
