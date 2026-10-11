import { getDisplayCategory } from "@/lib/transactions/categoryPresentation";
import type { PlaidMappedTransaction } from "@/lib/plaid/types";

const LEADING_CHANNEL =
  /^(?:pos|ach|checkcard|purchase)\b[\s*]*/i;
const LEADING_PROCESSOR = /^(?:sq|tst|sp)\s*\*\s*/i;
const DEBIT_CREDIT_CARD = /^(?:debit|credit)\s+card\b[\s*]*/i;
const DOMAIN = /\.(?:com|net|org|co)\b/gi;
const TRAILING_STORE_NUMBER = /\s+#?\d{2,}\s*$/;

/**
 * Display name for a bank description.
 * Grouping keys stay in merchantGroupKey; this only cleans what people read.
 */
export function cleanMerchantName(raw: string | null | undefined): string {
  const original = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!original) {
    return "Transaction";
  }

  let value = original.replace(LEADING_PROCESSOR, "").trim();
  let strippedChannel = false;
  let guard = 0;
  while (guard < 6 && LEADING_CHANNEL.test(value)) {
    value = value.replace(LEADING_CHANNEL, "").trim();
    strippedChannel = true;
    guard += 1;
  }

  value = value.replace(DEBIT_CREDIT_CARD, "").trim();
  if (strippedChannel) {
    value = value.replace(/^(?:debit|credit)\b[\s*]*/i, "").trim();
  }

  value = value.replace(DOMAIN, "");
  value = value.replace(/^www\b[\s.]*/i, "");
  value = value.replace(/[*#]+/g, " ");
  value = value.replace(TRAILING_STORE_NUMBER, "");
  value = value.replace(/\s{2,}/g, " ").trim();
  value = value.replace(/^[\s.*-]+|[\s.*-]+$/g, "").trim();

  if (!value) {
    return "Transaction";
  }

  const letters = value.replace(/[^A-Za-z]/g, "");
  if (letters.length > 0 && letters === letters.toUpperCase()) {
    value = value
      .toLowerCase()
      .split(" ")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  return value;
}

const REFUND_TEXT =
  /\b(refund|reversal|reimbursement|return(?:ed)?|purchase return)\b/i;
const TAX_REFUND = /\btax\s+(refund|return)\b/i;

const SPENDING_PRIMARY = new Set([
  "FOOD_AND_DRINK",
  "GENERAL_MERCHANDISE",
  "ENTERTAINMENT",
  "MEDICAL",
  "PERSONAL_CARE",
  "HOME_IMPROVEMENT",
  "GENERAL_SERVICES",
  "RENT_AND_UTILITIES",
  "TRANSPORTATION",
  "TRAVEL",
  "BANK_FEES",
]);

export type RefundSignal = {
  amount?: number | null;
  name?: string | null;
  merchant_name?: string | null;
  original_description?: string | null;
  personal_finance_category?: {
    primary?: string | null;
    detailed?: string | null;
  } | null;
};

export function isMerchantRefund(transaction: RefundSignal): boolean {
  const amount = typeof transaction.amount === "number" ? transaction.amount : 0;
  if (amount >= 0) {
    return false;
  }

  const detailed = transaction.personal_finance_category?.detailed ?? "";
  const haystack = `${transaction.merchant_name ?? ""} ${transaction.name ?? ""} ${transaction.original_description ?? ""} ${detailed}`;

  if (TAX_REFUND.test(haystack)) {
    return false;
  }

  if (REFUND_TEXT.test(haystack)) {
    return true;
  }

  const primary = transaction.personal_finance_category?.primary ?? "";
  return SPENDING_PRIMARY.has(primary);
}

const REFUND_CATEGORY_FALLBACK = new Set([
  "Income",
  "Payroll",
  "Interest",
  "Transfers",
  "Credit Card Payment",
  "Loan Payment",
  "Savings",
  "Mortgage",
  "Other",
  "Uncategorized",
]);

/** Keep a spending category so the refund reduces that category. */
export function categoryForMerchantRefund(
  transaction: RefundSignal,
  canonicalCategory: string,
): string {
  if (!isMerchantRefund(transaction)) {
    return canonicalCategory;
  }

  if (REFUND_CATEGORY_FALLBACK.has(canonicalCategory)) {
    return "Refund";
  }

  return canonicalCategory;
}

const TRANSFER_NAME =
  /\b(transfer|trnsfr|from savings|to savings|from checking|to checking|online transfer|payment thank you)\b/i;

const GENERIC_BANK_LABEL =
  /^(deposit|withdrawal|transfer|online banking|payment|ach deposit|ach withdrawal|mobile deposit)$/i;

function daysApart(left: string, right: string): number {
  const a = Date.parse(`${left.slice(0, 10)}T12:00:00Z`);
  const b = Date.parse(`${right.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.abs(a - b) / 86_400_000;
}

function canPairAsOwnedTransfer(transaction: PlaidMappedTransaction): boolean {
  if (transaction.amount < 0 || transaction.isPending) {
    return false;
  }

  if (transaction.type === "transfer") {
    return true;
  }

  const label = `${transaction.name} ${transaction.notes} ${transaction.category}`;
  if (TRANSFER_NAME.test(label)) {
    return true;
  }

  return GENERIC_BANK_LABEL.test(transaction.name.trim());
}

/**
 * Reclassify confident pairs that move between two different linked accounts.
 * A merchant charge is never paired with an unrelated deposit of the same amount.
 */
export function reclassifyOwnedAccountTransfers(
  transactions: PlaidMappedTransaction[],
): PlaidMappedTransaction[] {
  const result = transactions.map((transaction) => ({ ...transaction }));
  const used = new Set<string>();

  for (let index = 0; index < result.length; index += 1) {
    const left = result[index]!;
    if (used.has(left.externalTransactionId) || !canPairAsOwnedTransfer(left)) {
      continue;
    }

    for (let partner = index + 1; partner < result.length; partner += 1) {
      const right = result[partner]!;
      if (used.has(right.externalTransactionId) || !canPairAsOwnedTransfer(right)) {
        continue;
      }

      if (left.externalAccountId === right.externalAccountId) {
        continue;
      }

      if (Math.abs(Math.abs(left.amount) - Math.abs(right.amount)) > 0.009) {
        continue;
      }

      if (daysApart(left.date, right.date) > 3) {
        continue;
      }

      const oppositeDirection =
        (left.type === "income" && right.type === "expense") ||
        (left.type === "expense" && right.type === "income") ||
        (left.type === "transfer" && right.type !== "transfer") ||
        (right.type === "transfer" && left.type !== "transfer");

      if (!oppositeDirection) {
        continue;
      }

      for (const transaction of [left, right]) {
        transaction.type = "transfer";
        transaction.amount = Math.abs(transaction.amount);
        transaction.category = "Transfers";
        used.add(transaction.externalTransactionId);
      }
      break;
    }
  }

  return result;
}

/**
 * Posted Plaid rows reference the pending id they replace.
 * Never include an id that is itself a posted transaction in this batch.
 */
export function pendingIdsSupersededByPosted(
  transactions: Array<
    Pick<PlaidMappedTransaction, "externalTransactionId" | "isPending" | "pendingTransactionId">
  >,
): string[] {
  const postedIds = new Set(
    transactions
      .filter((transaction) => !transaction.isPending)
      .map((transaction) => transaction.externalTransactionId),
  );

  const pendingIds = transactions
    .filter(
      (transaction) =>
        !transaction.isPending &&
        Boolean(transaction.pendingTransactionId) &&
        transaction.pendingTransactionId !== transaction.externalTransactionId,
    )
    .map((transaction) => transaction.pendingTransactionId as string)
    .filter((id) => !postedIds.has(id));

  return [...new Set(pendingIds)];
}

export function canonicalCategoryLabel(rawCategory: string): string {
  return getDisplayCategory(rawCategory);
}
