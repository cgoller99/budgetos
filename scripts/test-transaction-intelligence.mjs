#!/usr/bin/env node
import assert from "node:assert/strict";
import { mapPlaidTransaction } from "../lib/plaid/mappers.ts";
import {
  cleanMerchantName,
  pendingIdsSupersededByPosted,
  reclassifyOwnedAccountTransfers,
} from "../lib/plaid/transactionIntelligence.ts";
import {
  buildMerchantCategoryMemory,
  categoryForSyncedTransaction,
} from "../lib/automation/categoryMemory.ts";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";
import { calculateMonthlySpendingFromLedger } from "../lib/calculations/spending.ts";
import { getPersonalLedgerIncomeForMonth } from "../lib/calculations/incomeLedger.ts";
import { hasPlaidIncomeHistory } from "../lib/calculations/income.ts";
import { computeCategoryBreakdown } from "../lib/reports/reportMetrics.ts";
import { getTransactionSummary } from "../lib/transactions/queries.ts";
import { monthlyAccountActivity } from "../lib/finance/accountActivity.ts";

const checking = { recordKind: "account", type: "checking" };
const credit = { recordKind: "debt", type: "credit_card" };

function plaid(partial) {
  return {
    transaction_id: partial.id,
    account_id: partial.accountId ?? "checking",
    amount: partial.amount,
    date: partial.date ?? "2026-10-08",
    name: partial.name ?? "Merchant",
    merchant_name: partial.merchantName ?? null,
    original_description: partial.description ?? null,
    pending: partial.pending ?? false,
    pending_transaction_id: partial.pendingTransactionId ?? null,
    personal_finance_category: partial.category ?? null,
    payment_channel: "other",
    transaction_type: "special",
  };
}

function ledger(partial) {
  return {
    id: partial.id,
    amount: partial.amount,
    type: partial.type,
    category: partial.category ?? "Shopping",
    accountId: partial.accountId ?? "checking",
    transferAccountId: null,
    date: partial.date ?? "2026-10-08",
    notes: partial.notes ?? "",
    goalId: null,
    billId: null,
    externalTransactionId: partial.externalTransactionId ?? null,
  };
}

assert.equal(cleanMerchantName("NETFLIX.COM"), "Netflix");
assert.equal(cleanMerchantName("Starbucks"), "Starbucks");
assert.equal(cleanMerchantName("McDonald's"), "McDonald's");
assert.equal(cleanMerchantName("ACH DEBIT NETFLIX.COM"), "Netflix");
assert.equal(cleanMerchantName("POS PURCHASE STARBUCKS 1234"), "Starbucks");
assert.equal(cleanMerchantName("SQ *BLUE BOTTLE"), "Blue Bottle");
assert.equal(cleanMerchantName("CREDIT ONE BANK"), "Credit One Bank");

const groceries = mapPlaidTransaction(
  plaid({
    id: "g1",
    amount: 54.2,
    name: "WHOLE FOODS 102",
    category: {
      primary: "FOOD_AND_DRINK",
      detailed: "FOOD_AND_DRINK_GROCERIES",
    },
  }),
  checking,
);
assert.equal(groceries.type, "expense");
assert.equal(groceries.amount, 54.2);
assert.equal(groceries.category, "Groceries");
assert.equal(groceries.name, "Whole Foods");

const cardPurchase = mapPlaidTransaction(
  plaid({
    id: "c1",
    amount: 42.5,
    name: "STARBUCKS",
    category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_COFFEE" },
  }),
  credit,
);
assert.equal(cardPurchase.type, "expense");
assert.equal(cardPurchase.amount, 42.5);
assert.equal(cardPurchase.category, "Restaurants");

const cardPayment = mapPlaidTransaction(
  plaid({
    id: "c2",
    amount: -500,
    name: "AUTOPAY PAYMENT",
    category: { primary: "LOAN_PAYMENTS", detailed: "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT" },
  }),
  credit,
);
assert.equal(cardPayment.type, "transfer");
assert.equal(cardPayment.amount, 500);

const explicitTransfer = mapPlaidTransaction(
  plaid({
    id: "t1",
    amount: -200,
    name: "ONLINE TRANSFER FROM SAVINGS",
    category: { primary: "TRANSFER_IN", detailed: "TRANSFER_IN_ACCOUNT_TRANSFER" },
  }),
  checking,
);
assert.equal(explicitTransfer.type, "transfer");

const amazonRefund = mapPlaidTransaction(
  plaid({
    id: "r1",
    amount: -25.4,
    name: "AMAZON.COM REFUND",
    category: {
      primary: "GENERAL_MERCHANDISE",
      detailed: "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES",
    },
  }),
  checking,
);
assert.equal(amazonRefund.type, "expense");
assert.equal(amazonRefund.amount, -25.4);
assert.equal(amazonRefund.category, "Shopping");
assert.equal(amazonRefund.name, "Amazon Refund");

const cardReturn = mapPlaidTransaction(
  plaid({
    id: "r2",
    amount: -18,
    name: "TARGET",
    category: { primary: "GENERAL_MERCHANDISE", detailed: "GENERAL_MERCHANDISE_SUPERSTORES" },
  }),
  credit,
);
assert.equal(cardReturn.type, "expense");
assert.equal(cardReturn.amount, -18);
assert.equal(cardReturn.category, "Shopping");

const payroll = mapPlaidTransaction(
  plaid({
    id: "p1",
    amount: -1604.21,
    name: "ACME PAYROLL",
    category: { primary: "INCOME", detailed: "INCOME_WAGES" },
  }),
  checking,
);
assert.equal(payroll.type, "income");
assert.equal(payroll.amount, 1604.21);
assert.equal(payroll.category, "Payroll");

const amazonReturn = mapPlaidTransaction(
  plaid({
    id: "r3",
    amount: -40,
    name: "AMAZON RETURN",
    category: { primary: "INCOME", detailed: "INCOME_OTHER_INCOME" },
  }),
  checking,
);
assert.equal(amazonReturn.type, "expense");
assert.equal(amazonReturn.amount, -40);
assert.equal(amazonReturn.category, "Refund");

const taxRefund = mapPlaidTransaction(
  plaid({
    id: "tax",
    amount: -800,
    name: "IRS TAX REFUND",
    category: { primary: "INCOME", detailed: "INCOME_TAX_REFUND" },
  }),
  checking,
);
assert.equal(taxRefund.type, "income");
assert.equal(taxRefund.amount, 800);

const returnedFee = mapPlaidTransaction(
  plaid({
    id: "fee",
    amount: 15,
    name: "RETURNED ITEM FEE",
    category: { primary: "BANK_FEES", detailed: "BANK_FEES_OTHER_BANK_FEES" },
  }),
  checking,
);
assert.equal(returnedFee.type, "expense");
assert.equal(returnedFee.amount, 15);

const posted = mapPlaidTransaction(
  plaid({
    id: "posted-1",
    amount: 12,
    pendingTransactionId: "pending-1",
    category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_COFFEE" },
  }),
  checking,
);
assert.equal(posted.pendingTransactionId, "pending-1");
assert.deepEqual(
  pendingIdsSupersededByPosted([
    posted,
    {
      externalTransactionId: "pending-1",
      isPending: true,
      pendingTransactionId: null,
    },
    {
      externalTransactionId: "posted-keep",
      isPending: false,
      pendingTransactionId: "posted-keep",
    },
  ]),
  ["pending-1"],
);

const paired = reclassifyOwnedAccountTransfers([
  {
    externalTransactionId: "out",
    externalAccountId: "checking",
    amount: 200,
    type: "expense",
    category: "Transfers",
    date: "2026-10-02",
    notes: "Online Transfer to Savings",
    name: "Online Transfer to Savings",
  },
  {
    externalTransactionId: "in",
    externalAccountId: "savings",
    amount: 200,
    type: "income",
    category: "Income",
    date: "2026-10-03",
    notes: "Deposit",
    name: "Deposit",
  },
  {
    externalTransactionId: "amazon",
    externalAccountId: "checking",
    amount: 50,
    type: "expense",
    category: "Shopping",
    date: "2026-10-04",
    notes: "Amazon",
    name: "Amazon",
  },
  {
    externalTransactionId: "pay",
    externalAccountId: "savings",
    amount: 50,
    type: "income",
    category: "Payroll",
    date: "2026-10-04",
    notes: "Acme Payroll",
    name: "Acme Payroll",
  },
]);
assert.equal(paired.find((item) => item.externalTransactionId === "out").type, "transfer");
assert.equal(paired.find((item) => item.externalTransactionId === "in").type, "transfer");
assert.equal(paired.find((item) => item.externalTransactionId === "amazon").type, "expense");
assert.equal(paired.find((item) => item.externalTransactionId === "pay").type, "income");

const memory = buildMerchantCategoryMemory([
  { notes: "WHOLE FOODS", category: "FOOD AND DRINK GROCERIES", date: "2026-09-01" },
  { notes: "Netflix", category: "Subscriptions", date: "2026-09-05" },
]);
assert.equal(
  categoryForSyncedTransaction({
    isNew: true,
    incomingCategory: "Groceries",
    merchantKey: "whole foods",
    memory,
  }),
  "Groceries",
);
assert.equal(
  categoryForSyncedTransaction({
    isNew: true,
    incomingCategory: "Entertainment",
    merchantKey: "netflix",
    memory,
  }),
  "Subscriptions",
);
assert.equal(
  categoryForSyncedTransaction({
    isNew: false,
    existingCategory: "FOOD AND DRINK GROCERIES",
    incomingCategory: "Groceries",
    merchantKey: "whole foods",
    memory,
  }),
  "FOOD AND DRINK GROCERIES",
);

const reference = new Date("2026-10-15T12:00:00Z");
const finance = {
  ...emptyFinanceData,
  accounts: [
    { id: "checking", name: "Checking", type: "checking", balance: 1000, institution: "Bank" },
    { id: "savings", name: "Savings", type: "savings", balance: 500, institution: "Bank" },
  ],
  transactions: [
    ledger({ id: "spend", amount: 100, type: "expense", category: "Groceries", notes: "Whole Foods" }),
    ledger({
      id: "old-refund",
      amount: 20,
      type: "income",
      category: "Shopping",
      notes: "Amazon refund",
      externalTransactionId: "plaid-refund",
    }),
    ledger({
      id: "neg",
      amount: -15,
      type: "expense",
      category: "Shopping",
      notes: "Target",
    }),
    ledger({
      id: "wages",
      amount: 1604.21,
      type: "income",
      category: "Payroll",
      notes: "Acme Payroll",
      externalTransactionId: "plaid-pay",
    }),
    ledger({
      id: "tax",
      amount: 800,
      type: "income",
      category: "Income",
      notes: "IRS tax refund",
      externalTransactionId: "plaid-tax",
    }),
  ],
};

assert.equal(getPersonalLedgerIncomeForMonth(finance, reference), 2404.21);
assert.equal(calculateMonthlySpendingFromLedger(finance, reference), 65);
assert.equal(getTransactionSummary(finance).monthIncome, 2404.21);
assert.equal(getTransactionSummary(finance).monthExpenses, 65);
assert.equal(hasPlaidIncomeHistory(finance), true);
assert.equal(
  hasPlaidIncomeHistory({
    ...finance,
    transactions: finance.transactions.filter((item) => item.id === "old-refund"),
  }),
  false,
);

const breakdown = computeCategoryBreakdown(finance);
const groceriesTotal = breakdown.find((item) => item.category === "Groceries");
const shoppingTotal = breakdown.find((item) => item.category === "Shopping");
assert.equal(groceriesTotal.amount, 100);
assert.equal(shoppingTotal, undefined);

const activity = monthlyAccountActivity(
  [{ date: "2026-10-03", amount: -18, type: "expense", accountId: "checking" }],
  "checking",
  1,
  reference,
);
assert.equal(activity.at(-1), 18);

console.log("transaction intelligence checks passed");
