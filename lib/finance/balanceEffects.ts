import { getCurrentYearMonth, findBillSplit } from "@/lib/finance/bills";
import {
  areAllSplitsPaid,
  getEffectiveBillSplits,
} from "@/lib/finance/billSplits";
import { getPrimaryCashAccount } from "@/lib/finance/cashAccount";
import type { Bill, BillSplit, FinanceData, Transaction } from "@/lib/finance/types";
import {
  applyGoalContributionEffect,
  applyTransactionEffect,
} from "@/lib/transactions/applyTransactionEffects";

export function resolvePaymentAccountId(
  data: FinanceData,
  preferredAccountId?: string | null,
): string | null {
  if (preferredAccountId) {
    const exists = data.accounts.some(
      (account) => account.id === preferredAccountId,
    );
    if (exists) {
      return preferredAccountId;
    }
  }

  return getPrimaryCashAccount(data)?.id ?? null;
}

export function applyBillSplitPaymentToData(
  data: FinanceData,
  bill: Bill,
  split: BillSplit,
  referenceDate = new Date(),
): FinanceData {
  const accountId = resolvePaymentAccountId(data, split.paymentAccountId);
  const hasStoredSplits = (bill.splits ?? []).length > 0;
  const paidMonth = getCurrentYearMonth(referenceDate);

  let updatedBill: Bill;

  if (hasStoredSplits) {
    const updatedSplits = (bill.splits ?? []).map((item) =>
      item.id === split.id ? { ...item, paidMonth } : item,
    );

    updatedBill = {
      ...bill,
      splits: updatedSplits,
      paidMonth: areAllSplitsPaid(
        { ...bill, splits: updatedSplits },
        referenceDate,
      )
        ? paidMonth
        : null,
    };
  } else {
    updatedBill = {
      ...bill,
      paidMonth,
    };
  }

  if (!accountId) {
    return {
      ...data,
      bills: data.bills.map((item) =>
        item.id === bill.id ? updatedBill : item,
      ),
    };
  }

  const transaction: Transaction = {
    id: crypto.randomUUID(),
    amount: split.amount,
    type: "expense",
    category: bill.category,
    accountId,
    transferAccountId: null,
    date: referenceDate.toISOString().split("T")[0] ?? referenceDate.toISOString(),
    notes: `${bill.name} bill payment`,
    billId: bill.id,
  };

  const withTransaction: FinanceData = {
    ...data,
    transactions: [transaction, ...data.transactions],
    bills: data.bills.map((item) =>
      item.id === bill.id ? updatedBill : item,
    ),
  };

  return applyTransactionEffect(withTransaction, transaction);
}

export function applyBillPaymentToData(
  data: FinanceData,
  bill: Bill,
  referenceDate = new Date(),
): FinanceData {
  const split = getEffectiveBillSplits(bill)[0];
  return applyBillSplitPaymentToData(data, bill, split, referenceDate);
}

export function applyBillSplitPaymentByIdToData(
  data: FinanceData,
  billId: string,
  splitId: string,
  referenceDate = new Date(),
): FinanceData {
  const match = findBillSplit(data, billId, splitId);

  if (!match) {
    return data;
  }

  return applyBillSplitPaymentToData(
    data,
    match.bill,
    match.split,
    referenceDate,
  );
}

export function applyDebtPaymentToData(
  data: FinanceData,
  debtId: string,
  amount: number,
  accountId?: string | null,
  referenceDate = new Date(),
): FinanceData {
  const debt = data.debts.find((item) => item.id === debtId);

  if (!debt) {
    return data;
  }

  const paymentAmount = Math.min(Math.max(amount, 0), debt.balance);
  const resolvedAccountId = resolvePaymentAccountId(data, accountId);

  let next: FinanceData = {
    ...data,
    debts: data.debts.map((item) =>
      item.id === debtId
        ? {
            ...item,
            balance: Math.max(item.balance - paymentAmount, 0),
            monthlyChange: -paymentAmount,
          }
        : item,
    ),
  };

  if (resolvedAccountId && paymentAmount > 0) {
    const transaction: Transaction = {
      id: crypto.randomUUID(),
      amount: paymentAmount,
      type: "expense",
      category: "Debt Payment",
      accountId: resolvedAccountId,
      transferAccountId: null,
      date: referenceDate.toISOString().split("T")[0] ?? referenceDate.toISOString(),
      notes: `${debt.name} payment`,
      debtId: debt.id,
    };

    next = {
      ...applyTransactionEffect(
        { ...next, transactions: [transaction, ...next.transactions] },
        transaction,
      ),
    };
  }

  return next;
}

export function applyGoalContributionToData(
  data: FinanceData,
  goalId: string,
  amount: number,
  accountId?: string | null,
  referenceDate = new Date(),
): FinanceData {
  const goal = data.savingsGoals.find((item) => item.id === goalId);

  if (!goal) {
    return data;
  }

  const resolvedAccountId = resolvePaymentAccountId(data, accountId);

  if (!resolvedAccountId) {
    return {
      ...data,
      savingsGoals: data.savingsGoals.map((item) =>
        item.id === goalId
          ? {
              ...item,
              current: Math.min(item.current + amount, item.target),
            }
          : item,
      ),
    };
  }

  const transaction: Transaction = {
    id: crypto.randomUUID(),
    amount,
    type: "expense",
    category: "Goal Contribution",
    accountId: resolvedAccountId,
    transferAccountId: null,
    date: referenceDate.toISOString().split("T")[0] ?? referenceDate.toISOString(),
    notes: `Contribution to ${goal.name}`,
    goalId: goal.id,
  };

  let next: FinanceData = {
    ...data,
    transactions: [transaction, ...data.transactions],
  };
  next = applyTransactionEffect(next, transaction);
  next = applyGoalContributionEffect(next, transaction);
  return next;
}
