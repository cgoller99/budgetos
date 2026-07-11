import type { FinanceData, Transaction } from "@/lib/finance/types";

const INTERNAL_TRANSFER_PATTERNS = [
  /\btransfer\b/i,
  /\btrnsfr\b/i,
  /\bfrom savings\b/i,
  /\bto savings\b/i,
  /\bfrom checking\b/i,
  /\bto checking\b/i,
  /\bmobile deposit\b/i,
  /\bvenmo cashout\b/i,
  /\bzelle\b/i,
  /\bcash app\b/i,
  /\bpaypal\b/i,
  /\b401k\b/i,
  /\broth\b/i,
  /\bbrokerage\b/i,
  /\binvestment\b/i,
  /\bhsa\b/i,
  /\bcd deposit\b/i,
  /\bmoney market\b/i,
];

function normalizeNotes(transaction: Transaction): string {
  return `${transaction.notes ?? ""} ${transaction.category ?? ""}`.trim();
}

function matchesInternalTransferPattern(transaction: Transaction): boolean {
  const haystack = normalizeNotes(transaction);

  return INTERNAL_TRANSFER_PATTERNS.some((pattern) => pattern.test(haystack));
}

function sameDay(left: string, right: string): boolean {
  return left.slice(0, 10) === right.slice(0, 10);
}

function amountsMatch(left: number, right: number): boolean {
  const tolerance = Math.max(Math.max(left, right) * 0.02, 1);
  return Math.abs(left - right) <= tolerance;
}

function isCashOrSavingsAccount(data: FinanceData, accountId: string): boolean {
  const account = data.accounts.find((item) => item.id === accountId);
  return account?.type === "checking" || account?.type === "savings" || account?.type === "cash";
}

export function isInternalTransferIncome(
  data: FinanceData,
  transaction: Transaction,
): boolean {
  if (transaction.type !== "income") {
    return false;
  }

  if (matchesInternalTransferPattern(transaction)) {
    return true;
  }

  const monthTransactions = (data.transactions ?? []).filter((item) =>
    sameDay(item.date, transaction.date),
  );

  const pairedTransfer = monthTransactions.some(
    (item) =>
      item.id !== transaction.id &&
      item.type === "transfer" &&
      amountsMatch(item.amount, transaction.amount) &&
      item.accountId !== transaction.accountId,
  );

  if (pairedTransfer) {
    return true;
  }

  const pairedExpense = monthTransactions.some(
    (item) =>
      item.id !== transaction.id &&
      item.type === "expense" &&
      amountsMatch(item.amount, transaction.amount) &&
      item.accountId !== transaction.accountId &&
      isCashOrSavingsAccount(data, item.accountId) &&
      isCashOrSavingsAccount(data, transaction.accountId),
  );

  return pairedExpense;
}

export function filterRealIncomeTransactions(
  data: FinanceData,
  transactions: Transaction[],
): Transaction[] {
  return transactions.filter(
    (transaction) => !isInternalTransferIncome(data, transaction),
  );
}
