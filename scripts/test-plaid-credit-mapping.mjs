#!/usr/bin/env node
/**
 * Validates credit-card Plaid transaction classification.
 *
 * Usage: npm run test:plaid-credit-mapping
 */

import assert from "node:assert/strict";

function toNumber(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return value;
}

function resolvePlaidTransactionType(transaction, accountContext) {
  const primary = transaction.personal_finance_category?.primary;
  const detailed = transaction.personal_finance_category?.detailed ?? "";

  if (
    primary === "TRANSFER_IN" ||
    primary === "TRANSFER_OUT" ||
    detailed.startsWith("TRANSFER_")
  ) {
    return "transfer";
  }

  const amount = toNumber(transaction.amount);
  const isCreditCard =
    accountContext?.recordKind === "debt" &&
    accountContext.type === "credit_card";

  if (isCreditCard) {
    if (amount <= 0) {
      return "transfer";
    }

    return "expense";
  }

  if (primary === "INCOME" || primary === "DEPOSIT") {
    return "income";
  }

  if (primary === "LOAN_PAYMENTS") {
    return "transfer";
  }

  return amount < 0 ? "income" : "expense";
}

const creditContext = { recordKind: "debt", type: "credit_card" };

assert.equal(
  resolvePlaidTransactionType(
    { amount: 42.5, personal_finance_category: { primary: "FOOD_AND_DRINK" } },
    creditContext,
  ),
  "expense",
  "credit purchase should be expense",
);

assert.equal(
  resolvePlaidTransactionType(
    { amount: -500, personal_finance_category: { primary: "LOAN_PAYMENTS" } },
    creditContext,
  ),
  "transfer",
  "credit payment should be transfer",
);

assert.equal(
  resolvePlaidTransactionType(
    { amount: -500, personal_finance_category: { primary: "TRANSFER_IN" } },
    creditContext,
  ),
  "transfer",
  "explicit transfer stays transfer",
);

assert.equal(
  resolvePlaidTransactionType(
    { amount: 1200, personal_finance_category: { primary: "INCOME" } },
    { recordKind: "account", type: "checking" },
  ),
  "income",
  "checking deposit stays income",
);

console.log("✅ Plaid credit-card mapping checks passed.");
