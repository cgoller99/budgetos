import type { FinanceData, Transaction } from "@/lib/finance/types";
import { getDisplayCategory } from "@/lib/transactions/categoryPresentation";

/** Peer-payment apps — do NOT treat as internal transfers unless paired. */
const PEER_PAYMENT_PATTERNS = [
  /\bvenmo\b/i,
  /\bzelle\b/i,
  /\bcash app\b/i,
  /\bpaypal\b/i,
  /\bapple cash\b/i,
];

const INTERNAL_TRANSFER_PATTERNS = [
  /\btransfer\b/i,
  /\btrnsfr\b/i,
  /\baccount transfer\b/i,
  /\bonline transfer\b/i,
  /\bfrom savings\b/i,
  /\bto savings\b/i,
  /\bfrom checking\b/i,
  /\bto checking\b/i,
  /\bmobile deposit\b/i,
  /\b401k\b/i,
  /\broth\b/i,
  /\bbrokerage\b/i,
  /\binvestment\b/i,
  /\bhsa\b/i,
  /\bcd deposit\b/i,
  /\bmoney market\b/i,
  /\bcredit card payment\b/i,
  /\bpayment to credit card\b/i,
  /\bloan payment\b/i,
];

function normalizeNotes(transaction: Transaction): string {
  return `${transaction.notes ?? ""} ${transaction.category ?? ""}`.trim();
}

function isPeerPayment(transaction: Transaction): boolean {
  return PEER_PAYMENT_PATTERNS.some((pattern) => pattern.test(normalizeNotes(transaction)));
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
  return (
    account?.type === "checking" ||
    account?.type === "savings" ||
    account?.type === "cash"
  );
}

function isOwnAccount(data: FinanceData, accountId: string): boolean {
  return (data.accounts ?? []).some((account) => account.id === accountId);
}

function hasPairedCounterparty(
  data: FinanceData,
  transaction: Transaction,
): boolean {
  const dayTransactions = (data.transactions ?? []).filter((item) =>
    sameDay(item.date, transaction.date),
  );

  const pairedTransfer = dayTransactions.some(
    (item) =>
      item.id !== transaction.id &&
      item.type === "transfer" &&
      amountsMatch(item.amount, transaction.amount) &&
      item.accountId !== transaction.accountId &&
      isOwnAccount(data, item.accountId),
  );

  if (pairedTransfer) {
    return true;
  }

  const oppositeType = transaction.type === "income" ? "expense" : "income";

  return dayTransactions.some(
    (item) =>
      item.id !== transaction.id &&
      (item.type === oppositeType || item.type === "transfer") &&
      amountsMatch(item.amount, transaction.amount) &&
      item.accountId !== transaction.accountId &&
      isCashOrSavingsAccount(data, item.accountId) &&
      isCashOrSavingsAccount(data, transaction.accountId),
  );
}

function categoryLooksLikeInternalTransfer(transaction: Transaction): boolean {
  const display = getDisplayCategory(transaction.category);
  if (
    display === "Transfers" ||
    display === "Credit Card Payment" ||
    display === "Loan Payment" ||
    display === "Mortgage"
  ) {
    return true;
  }

  const key = (transaction.category ?? "")
    .trim()
    .toUpperCase()
    .replace(/[_-]+/g, " ");

  return (
    key.startsWith("TRANSFER") ||
    key.startsWith("LOAN PAYMENTS") ||
    key.includes("ACCOUNT TRANSFER") ||
    key.includes("CREDIT CARD PAYMENT")
  );
}

/**
 * Conservative: only when we are confident money moved between the user's
 * own accounts (or is a debt payment), not a real expense/income.
 */
export function isConfidentInternalTransfer(
  data: FinanceData,
  transaction: Transaction,
): boolean {
  if (transaction.type === "transfer") {
    return true;
  }

  if (transaction.goalId) {
    return false;
  }

  if (isPeerPayment(transaction) && !hasPairedCounterparty(data, transaction)) {
    return false;
  }

  if (categoryLooksLikeInternalTransfer(transaction)) {
    return true;
  }

  if (matchesInternalTransferPattern(transaction)) {
    // Pattern alone is not enough for peer-payment-like noise; require own accounts.
    if (isCashOrSavingsAccount(data, transaction.accountId)) {
      return true;
    }
  }

  if (hasPairedCounterparty(data, transaction)) {
    return true;
  }

  return false;
}

export function isInternalTransferIncome(
  data: FinanceData,
  transaction: Transaction,
): boolean {
  if (transaction.type !== "income") {
    return false;
  }

  return isConfidentInternalTransfer(data, transaction);
}

export function isInternalTransferExpense(
  data: FinanceData,
  transaction: Transaction,
): boolean {
  if (transaction.type !== "expense") {
    return false;
  }

  return isConfidentInternalTransfer(data, transaction);
}

export function filterRealIncomeTransactions(
  data: FinanceData,
  transactions: Transaction[],
): Transaction[] {
  return transactions.filter(
    (transaction) => !isInternalTransferIncome(data, transaction),
  );
}

export function filterRealExpenseTransactions(
  data: FinanceData,
  transactions: Transaction[],
): Transaction[] {
  return transactions.filter(
    (transaction) => !isInternalTransferExpense(data, transaction),
  );
}
