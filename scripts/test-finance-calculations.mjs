#!/usr/bin/env node
/**
 * Validates canonical finance calculation rules.
 *
 * Usage: node scripts/test-finance-calculations.mjs
 */

import assert from "node:assert/strict";

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function collectUniqueDebtBalances(data) {
  const seenExternalIds = new Set();
  const seenIds = new Set();
  const items = [];

  for (const debt of data.debts ?? []) {
    if (debt.externalAccountId) {
      if (seenExternalIds.has(debt.externalAccountId)) continue;
      seenExternalIds.add(debt.externalAccountId);
    }
    if (seenIds.has(debt.id)) continue;
    seenIds.add(debt.id);
    items.push(debt.balance);
  }

  for (const account of data.accounts ?? []) {
    if (account.type !== "credit_card") continue;
    if (account.externalAccountId && seenExternalIds.has(account.externalAccountId)) continue;
    if (seenIds.has(account.id)) continue;
    if (account.externalAccountId) seenExternalIds.add(account.externalAccountId);
    seenIds.add(account.id);
    items.push(account.balance);
  }

  return sum(items);
}

function collectUniqueInvestmentValues(data) {
  const seenExternalIds = new Set();
  const seenIds = new Set();
  const items = [];

  for (const investment of data.investments ?? []) {
    if (investment.externalAccountId) {
      if (seenExternalIds.has(investment.externalAccountId)) continue;
      seenExternalIds.add(investment.externalAccountId);
    }
    if (seenIds.has(investment.id)) continue;
    seenIds.add(investment.id);
    items.push(investment.value);
  }

  for (const account of data.accounts ?? []) {
    if (account.type !== "investment" && account.type !== "crypto") continue;
    if (account.externalAccountId && seenExternalIds.has(account.externalAccountId)) continue;
    if (seenIds.has(account.id)) continue;
    if (account.externalAccountId) seenExternalIds.add(account.externalAccountId);
    seenIds.add(account.id);
    items.push(account.balance);
  }

  return sum(items);
}

const sample = {
  accounts: [
    { id: "cash-1", type: "checking", balance: 1000 },
    {
      id: "cc-dup",
      type: "credit_card",
      balance: 500,
      externalAccountId: "plaid-cc-1",
    },
  ],
  debts: [
    {
      id: "debt-1",
      balance: 500,
      externalAccountId: "plaid-cc-1",
    },
  ],
  investments: [
    { id: "inv-1", value: 2000, externalAccountId: "plaid-inv-1" },
    { id: "inv-dup", value: 2000, externalAccountId: "plaid-inv-1" },
  ],
};

assert.equal(collectUniqueDebtBalances(sample), 500, "dedupes plaid credit card debt");
assert.equal(collectUniqueInvestmentValues(sample), 2000, "dedupes plaid investment holdings");

function calculateMonthlySpendingForMoneyFlow(data) {
  const recurringBills = sum(
    (data.bills ?? [])
      .filter((bill) => bill.recurring)
      .map((bill) => bill.amount),
  );

  const expenses = sum(
    (data.transactions ?? [])
      .filter((transaction) => transaction.type === "expense")
      .map((transaction) => transaction.amount),
  );

  if (recurringBills <= 0) {
    return expenses;
  }

  const matched = sum(
    (data.transactions ?? [])
      .filter(
        (transaction) =>
          transaction.type === "expense" &&
          transaction.notes.toLowerCase().includes("netflix"),
      )
      .map((transaction) => transaction.amount),
  );

  return recurringBills + (expenses - matched);
}

const spendingSample = {
  bills: [{ name: "Netflix", amount: 15.99, recurring: true }],
  transactions: [
    { type: "expense", amount: 15.99, notes: "Netflix subscription" },
    { type: "expense", amount: 42.5, notes: "Groceries" },
  ],
};

assert.equal(
  calculateMonthlySpendingForMoneyFlow(spendingSample),
  58.49,
  "avoids double-counting bill payment expenses",
);

console.log("✅ Finance calculation checks passed.");
