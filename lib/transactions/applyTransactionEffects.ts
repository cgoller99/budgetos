import type { FinanceData, Transaction } from "@/lib/finance/types";

function adjustAccountBalance(
  accounts: FinanceData["accounts"],
  accountId: string,
  delta: number,
): FinanceData["accounts"] {
  return accounts.map((account) =>
    account.id === accountId
      ? { ...account, balance: Math.max(0, account.balance + delta) }
      : account,
  );
}

export function applyTransactionEffect(
  data: FinanceData,
  transaction: Transaction,
  direction: 1 | -1 = 1,
): FinanceData {
  const amount = transaction.amount * direction;

  switch (transaction.type) {
    case "income":
      return {
        ...data,
        accounts: adjustAccountBalance(
          data.accounts,
          transaction.accountId,
          amount,
        ),
      };
    case "expense":
      return {
        ...data,
        accounts: adjustAccountBalance(
          data.accounts,
          transaction.accountId,
          -amount,
        ),
      };
    case "transfer": {
      if (!transaction.transferAccountId) {
        return data;
      }

      let accounts = adjustAccountBalance(
        data.accounts,
        transaction.accountId,
        -amount,
      );
      accounts = adjustAccountBalance(
        accounts,
        transaction.transferAccountId,
        amount,
      );

      return { ...data, accounts };
    }
    default:
      return data;
  }
}

export function revertTransactionEffect(
  data: FinanceData,
  transaction: Transaction,
): FinanceData {
  return applyTransactionEffect(data, transaction, -1);
}

export function applyGoalContributionEffect(
  data: FinanceData,
  transaction: Transaction,
  direction: 1 | -1 = 1,
): FinanceData {
  if (transaction.type !== "expense" || !transaction.goalId) {
    return data;
  }

  const contribution = transaction.amount * direction;

  return {
    ...data,
    savingsGoals: data.savingsGoals.map((goal) =>
      goal.id === transaction.goalId
        ? {
            ...goal,
            current: Math.min(
              Math.max(goal.current + contribution, 0),
              goal.target,
            ),
          }
        : goal,
    ),
  };
}

export function addTransactionToData(
  data: FinanceData,
  transaction: Transaction,
): FinanceData {
  const withTransaction: FinanceData = {
    ...data,
    transactions: [transaction, ...data.transactions],
  };

  let next = applyTransactionEffect(withTransaction, transaction);
  next = applyGoalContributionEffect(next, transaction);
  return next;
}

export function updateTransactionInData(
  data: FinanceData,
  transactionId: string,
  updated: Transaction,
): FinanceData {
  const existing = data.transactions.find(
    (transaction) => transaction.id === transactionId,
  );

  if (!existing) {
    return data;
  }

  let next = revertTransactionEffect(data, existing);
  next = applyGoalContributionEffect(next, existing, -1);
  next = {
    ...next,
    transactions: next.transactions.map((transaction) =>
      transaction.id === transactionId ? updated : transaction,
    ),
  };
  next = applyTransactionEffect(next, updated);
  next = applyGoalContributionEffect(next, updated);
  return next;
}

export function removeTransactionFromData(
  data: FinanceData,
  transactionId: string,
): FinanceData {
  const existing = data.transactions.find(
    (transaction) => transaction.id === transactionId,
  );

  if (!existing) {
    return data;
  }

  let next = revertTransactionEffect(data, existing);
  next = applyGoalContributionEffect(next, existing, -1);
  return {
    ...next,
    transactions: next.transactions.filter(
      (transaction) => transaction.id !== transactionId,
    ),
  };
}
