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
import { calculateCashFlow, calculateMonthlySpending } from "../lib/calculations/cashFlow.ts";
import { calculateMonthlyIncome, hasPlaidIncomeHistory } from "../lib/calculations/income.ts";
import { getPersonalLedgerIncomeForMonth } from "../lib/calculations/incomeLedger.ts";
import { getSafeToSpend } from "../lib/finance/safeToSpend.ts";
import { computeCategoryBreakdown, computeMonthlyTrends } from "../lib/reports/reportMetrics.ts";
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
  { notes: "AMAZON MARKETPLACE", category: "Groceries", date: "2026-09-02" },
  { notes: "AMAZON MARKETPLACE", category: "Shopping", date: "2026-08-01" },
  { notes: "WALMART", category: "Shopping", date: "2026-09-03" },
  { notes: "TARGET", category: "Shopping", date: "2026-09-04" },
  { notes: "PAYPAL", category: "Shopping", date: "2026-09-06" },
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
assert.equal(
  categoryForSyncedTransaction({
    isNew: true,
    incomingCategory: "Shopping",
    merchantKey: "amazon marketplace",
    memory,
  }),
  "Shopping",
);
assert.equal(
  categoryForSyncedTransaction({
    isNew: true,
    incomingCategory: "FOOD AND DRINK GROCERIES",
    merchantKey: "amazon marketplace",
    memory,
  }),
  "Groceries",
);
assert.equal(
  categoryForSyncedTransaction({
    isNew: true,
    incomingCategory: "Groceries",
    merchantKey: "walmart",
    memory,
  }),
  "Groceries",
);
assert.equal(
  categoryForSyncedTransaction({
    isNew: true,
    incomingCategory: "Transfers",
    merchantKey: "paypal",
    memory,
  }),
  "Transfers",
);
assert.equal(
  categoryForSyncedTransaction({
    isNew: true,
    incomingCategory: "Uncategorized",
    merchantKey: "target",
    memory,
  }),
  "Shopping",
);
assert.equal(
  categoryForSyncedTransaction({
    isNew: true,
    incomingCategory: "Uncategorized",
    merchantKey: "amazon marketplace",
    memory,
  }),
  "Uncategorized",
);
assert.equal(
  categoryForSyncedTransaction({
    isNew: false,
    existingCategory: "Groceries",
    incomingCategory: "Shopping",
    merchantKey: "amazon marketplace",
    memory,
  }),
  "Groceries",
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

const now = new Date();
const coverageDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15`;
const coverageAccount = {
  id: "checking",
  name: "Checking",
  institution: "Bank",
  type: "checking",
  balance: 5000,
  monthlyChange: 0,
};
const coverage = {
  ...emptyFinanceData,
  accounts: [coverageAccount],
  bills: [
    {
      id: "rent",
      name: "Rent",
      amount: 500,
      dueDay: 1,
      autopay: false,
      recurring: true,
      category: "Rent",
      paidMonth: null,
      frequency: "monthly",
    },
  ],
  transactions: [
    ledger({
      id: "groceries",
      amount: 100,
      type: "expense",
      category: "Groceries",
      notes: "Whole Foods",
      date: coverageDay,
    }),
    ledger({
      id: "target",
      amount: 40,
      type: "expense",
      category: "Shopping",
      notes: "Target",
      date: coverageDay,
    }),
    ledger({
      id: "target-refund",
      amount: -15,
      type: "expense",
      category: "Shopping",
      notes: "Target",
      date: coverageDay,
    }),
    ledger({
      id: "amazon-refund",
      amount: 20,
      type: "income",
      category: "Shopping",
      notes: "Amazon refund",
      date: coverageDay,
      externalTransactionId: "plaid-amazon-refund",
    }),
    ledger({
      id: "wages",
      amount: 2000,
      type: "income",
      category: "Payroll",
      notes: "Acme Payroll",
      date: coverageDay,
      externalTransactionId: "plaid-wages",
    }),
  ],
};

assert.equal(calculateMonthlyIncome(coverage, now), 2000);
assert.equal(calculateMonthlySpending(coverage, now), 605);
const cashFlow = calculateCashFlow(coverage, now);
assert.equal(cashFlow.income, 2000);
assert.equal(cashFlow.spending, 605);
assert.equal(cashFlow.netFlow, 1395);
assert.equal(getSafeToSpend(coverage, now), 1395);

const capped = getSafeToSpend(
  {
    ...coverage,
    accounts: [
      {
        ...coverageAccount,
        balance: 400,
        availableBalance: 400,
        externalAccountId: "plaid-checking",
      },
    ],
  },
  now,
);
assert.equal(capped, 400);

const coverageBreakdown = computeCategoryBreakdown(coverage);
assert.equal(coverageBreakdown.find((item) => item.category === "Groceries").amount, 100);
assert.equal(coverageBreakdown.find((item) => item.category === "Shopping").amount, 5);
const coverageMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const trend = computeMonthlyTrends(coverage, now).find((item) => item.key === coverageMonth);
assert.equal(trend.spending, 605);
assert.equal(trend.income, 2000);

const activity = monthlyAccountActivity(
  [{ date: "2026-10-03", amount: -18, type: "expense", accountId: "checking" }],
  "checking",
  1,
  reference,
);
assert.equal(activity.at(-1), 18);

console.log("transaction intelligence checks passed");
