import { getDisplayCategory } from "@/lib/transactions/categoryPresentation";

const REFUND_LABEL = /\b(refund|reversal|reimbursement)\b/i;
const TAX_REFUND = /\btax\s+(refund|return)\b/i;

/**
 * Money coming back from a merchant.
 * Tax refunds stay income. Negative expenses are refunds already stored
 * against spending.
 */
export function isRefundActivity(transaction: {
  notes?: string | null;
  name?: string | null;
  category?: string | null;
  type?: string | null;
  amount?: number | null;
}): boolean {
  if (transaction.type === "transfer") {
    return false;
  }

  const label = `${transaction.notes ?? ""} ${transaction.name ?? ""} ${transaction.category ?? ""}`;
  if (TAX_REFUND.test(label)) {
    return false;
  }

  if (transaction.type === "expense" && (transaction.amount ?? 0) < 0) {
    return true;
  }

  if ((transaction.category ?? "").trim().toLowerCase() === "refund") {
    return true;
  }

  if (getDisplayCategory(transaction.category) === "Refund") {
    return true;
  }

  return REFUND_LABEL.test(label);
}

/** Expense stored as a negative amount is money coming back, not a new charge. */
export function isDisplayedInflow(transaction: {
  type?: string | null;
  amount?: number | null;
}): boolean {
  if (transaction.type === "income") {
    return true;
  }

  return transaction.type === "expense" && (transaction.amount ?? 0) < 0;
}
