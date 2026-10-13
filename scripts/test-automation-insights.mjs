#!/usr/bin/env node
import assert from "node:assert/strict";
import { merchantGroupKey, normalizeMerchantKey } from "../lib/bills/merchantMatch.ts";
import {
  buildMerchantCategoryMemory,
  categoryForSyncedTransaction,
} from "../lib/automation/categoryMemory.ts";
import {
  buildFinancialInsights,
  findBudgetOverspending,
  findSubscriptionPriceIncreases,
  findUnusualTransactions,
  suggestCategoryBudgets,
} from "../lib/automation/financialInsights.ts";
import { detectRecurringBillSuggestions } from "../lib/automation/detectRecurringBills.ts";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";

const reference = new Date("2026-10-11T12:00:00");

function transaction(partial) {
  return {
    id: partial.id,
    amount: partial.amount,
    type: partial.type ?? "expense",
    category: partial.category ?? "FOOD AND DRINK GROCERIES",
    accountId: "acct",
    transferAccountId: null,
    date: partial.date,
    notes: partial.notes ?? "",
    billId: partial.billId ?? null,
    goalId: partial.goalId ?? null,
    ownerUserId: partial.ownerUserId ?? null,
  };
}

function finance(partial) {
  return {
    ...emptyFinanceData,
    ...partial,
  };
}

assert.equal(normalizeMerchantKey("  NETFLIX.COM  "), "netflix com");
assert.equal(merchantGroupKey("NETFLIX.COM 800"), "netflix");
assert.equal(merchantGroupKey("Netflix"), "netflix");
assert.equal(merchantGroupKey("POS STARBUCKS 1234"), "starbucks");

const memory = buildMerchantCategoryMemory([
  { notes: "NETFLIX.COM", category: "ENTERTAINMENT", date: "2026-08-05" },
  { notes: "Netflix", category: "Subscriptions", date: "2026-09-05" },
]);
assert.equal(memory.latest.get("netflix"), "Subscriptions");
assert.equal(
  categoryForSyncedTransaction({
    isNew: false,
    existingCategory: "Subscriptions",
    incomingCategory: "ENTERTAINMENT",
    merchantKey: "netflix",
    memory,
  }),
  "Subscriptions",
);
assert.equal(
  categoryForSyncedTransaction({
    isNew: true,
    incomingCategory: "ENTERTAINMENT",
    merchantKey: "netflix",
    memory,
  }),
  "Subscriptions",
);

const recurring = detectRecurringBillSuggestions(
  finance({
    transactions: [
      transaction({ id: "n1", amount: 15.99, date: "2026-08-05", notes: "Netflix" }),
      transaction({ id: "n2", amount: 15.99, date: "2026-09-05", notes: "NETFLIX.COM" }),
    ],
  }),
  reference,
);
assert.equal(recurring.length, 1);
assert.equal(recurring[0].primaryAction.type, "create_bill");
assert.match(recurring[0].description, /will not add it until you confirm/);
assert.match(recurring[0].description, /next charge/i);

const increases = findSubscriptionPriceIncreases(
  finance({
    bills: [
      {
        id: "bill-netflix",
        name: "Netflix",
        amount: 15.99,
        dueDay: 5,
        autopay: true,
        recurring: true,
        category: "Subscriptions",
        paidMonth: null,
      },
    ],
    transactions: [
      transaction({
        id: "p1",
        amount: 15.99,
        date: "2026-08-05",
        notes: "Netflix",
        billId: "bill-netflix",
        category: "Subscriptions",
      }),
      transaction({
        id: "p2",
        amount: 19.99,
        date: "2026-09-05",
        notes: "Netflix",
        billId: "bill-netflix",
        category: "Subscriptions",
      }),
    ],
  }),
);
assert.equal(increases.length, 1);
assert.equal(increases[0].latestAmount, 19.99);

const insights = buildFinancialInsights(
  finance({
    accounts: [
      {
        id: "acct",
        name: "Checking",
        institution: "Bank",
        type: "checking",
        balance: 40,
        monthlyChange: 0,
      },
    ],
    bills: [
      {
        id: "rent",
        name: "Rent",
        amount: 50000,
        dueDay: 15,
        autopay: false,
        recurring: true,
        category: "Housing",
        paidMonth: null,
      },
    ],
    incomePlan: {
      id: "plan",
      paySchedule: "biweekly",
      paycheckAmount: 2000,
      anchorDate: "2026-01-02",
      weeklyDayOfWeek: null,
      monthlyDays: [],
      customIntervalDays: null,
      depositAccountId: null,
      nextPayDate: "2026-10-16",
      lastProcessedDate: null,
      isActive: true,
      allocations: [],
    },
    savingsGoals: [
      {
        id: "goal-1",
        name: "Emergency fund",
        type: "emergency_fund",
        icon: "🛟",
        current: 100,
        target: 10000,
        createdAt: "2026-01-01",
      },
    ],
    transactions: [
      transaction({ id: "a1", amount: 200, date: "2026-08-04", category: "FOOD AND DRINK GROCERIES" }),
      transaction({ id: "a2", amount: 220, date: "2026-08-18", category: "FOOD AND DRINK GROCERIES" }),
      transaction({ id: "s1", amount: 500, date: "2026-09-03", category: "FOOD AND DRINK GROCERIES" }),
      transaction({ id: "s2", amount: 480, date: "2026-09-20", category: "GENERAL MERCHANDISE" }),
      transaction({
        id: "pay-1",
        amount: 2600,
        type: "income",
        date: "2026-10-02",
        notes: "Payroll",
        category: "INCOME WAGES",
      }),
      transaction({
        id: "goal-pay",
        amount: 50,
        date: "2026-09-15",
        notes: "Goal",
        category: "Savings",
        goalId: "goal-1",
      }),
    ],
  }),
  reference,
);

assert.ok(insights.some((item) => item.id === "insight-spending-2026-09"));
assert.ok(insights.some((item) => item.id === "insight-paycheck-pay-1"));
assert.ok(insights.some((item) => item.id === "insight-goal-goal-1"));
assert.ok(insights.some((item) => item.title.includes("Upcoming bills")));
assert.ok(insights.every((item) => !item.detail.includes("undefined")));

const budgets = suggestCategoryBudgets(
  finance({
    transactions: [
      transaction({ id: "g-a", amount: 100, date: "2026-08-02", category: "FOOD AND DRINK GROCERIES" }),
      transaction({ id: "g-b", amount: 140, date: "2026-09-02", category: "FOOD AND DRINK GROCERIES" }),
      transaction({ id: "shop", amount: 80, date: "2026-09-03", category: "GENERAL MERCHANDISE" }),
    ],
  }),
  reference,
);
assert.equal(budgets.length, 1);
assert.equal(budgets[0].category, "Groceries");
assert.equal(budgets[0].amount, 120);

const unusual = findUnusualTransactions(
  finance({
    viewerUserId: "user-a",
    transactions: [
      transaction({ id: "g1", amount: 40, date: "2026-07-02", notes: "Market" }),
      transaction({ id: "g2", amount: 46, date: "2026-07-20", notes: "Market" }),
      transaction({ id: "g3", amount: 42, date: "2026-08-08", notes: "Market" }),
      transaction({ id: "g4", amount: 44, date: "2026-09-01", notes: "Market" }),
      transaction({
        id: "g-big",
        amount: 180,
        date: "2026-10-05",
        notes: "Whole Foods",
      }),
      transaction({
        id: "g-bigger",
        amount: 240,
        date: "2026-10-06",
        notes: "Whole Foods extra",
      }),
      transaction({
        id: "g-normal",
        amount: 48,
        date: "2026-10-04",
        notes: "Market",
      }),
      transaction({
        id: "bill-charge",
        amount: 400,
        date: "2026-10-03",
        notes: "Netflix",
        category: "Subscriptions",
        billId: "bill-netflix",
      }),
      transaction({
        id: "transfer",
        amount: 900,
        date: "2026-10-03",
        notes: "Transfer to savings",
        category: "Transfers",
        type: "transfer",
      }),
      transaction({
        id: "other-owner",
        amount: 500,
        date: "2026-10-04",
        notes: "Roommate store",
        category: "Shopping",
        ownerUserId: "user-b",
      }),
      transaction({
        id: "refund",
        amount: -80,
        date: "2026-10-04",
        notes: "Market refund",
      }),
    ],
  }),
  reference,
);
assert.equal(unusual.length, 1);
assert.equal(unusual[0].id, "insight-unusual-Groceries");
assert.match(unusual[0].detail, /Whole Foods extra was \$240\.00 on 2026-10-06/);
assert.match(unusual[0].detail, /typical Groceries charge/);
assert.match(unusual[0].detail, /4 confirmed expenses/);
assert.equal(unusual[0].detail.includes("undefined"), false);

const quiet = findUnusualTransactions(
  finance({
    transactions: [
      transaction({ id: "q1", amount: 40, date: "2026-08-02", notes: "Market" }),
      transaction({ id: "q2", amount: 42, date: "2026-09-02", notes: "Market" }),
      transaction({ id: "q3", amount: 55, date: "2026-10-05", notes: "Market" }),
    ],
  }),
  reference,
);
assert.equal(quiet.length, 0);

const novel = findUnusualTransactions(
  finance({
    transactions: [
      transaction({ id: "o1", amount: 20, date: "2026-07-02", notes: "Cafe", category: "Restaurants" }),
      transaction({ id: "o2", amount: 22, date: "2026-07-18", notes: "Cafe", category: "Restaurants" }),
      transaction({ id: "o3", amount: 18, date: "2026-08-04", notes: "Cafe", category: "Restaurants" }),
      transaction({ id: "o4", amount: 24, date: "2026-08-20", notes: "Cafe", category: "Restaurants" }),
      transaction({ id: "o5", amount: 21, date: "2026-09-06", notes: "Cafe", category: "Restaurants" }),
      transaction({
        id: "o-new",
        amount: 320,
        date: "2026-10-07",
        notes: "Electronics store",
        category: "GENERAL MERCHANDISE",
      }),
    ],
  }),
  reference,
);
assert.equal(novel.length, 1);
assert.equal(novel[0].id, "insight-unusual-Shopping");
assert.match(novel[0].detail, /not enough earlier Shopping charges/);
assert.match(novel[0].detail, /Electronics store was \$320\.00/);

const over = findBudgetOverspending(
  finance({
    viewerUserId: "user-a",
    transactions: [
      transaction({ id: "b1", amount: 80, date: "2026-10-02", notes: "Market" }),
      transaction({ id: "b2", amount: 50, date: "2026-10-05", notes: "Market" }),
      transaction({ id: "b3", amount: -20, date: "2026-10-06", notes: "Market refund" }),
      transaction({
        id: "b-goal",
        amount: 100,
        date: "2026-10-04",
        notes: "Goal",
        category: "Savings",
        goalId: "goal-1",
      }),
      transaction({
        id: "b-other",
        amount: 400,
        date: "2026-10-04",
        notes: "Roommate",
        ownerUserId: "user-b",
      }),
      transaction({
        id: "b-transfer",
        amount: 300,
        date: "2026-10-04",
        category: "Transfers",
        type: "transfer",
      }),
      transaction({
        id: "shop-1",
        amount: 30,
        date: "2026-10-03",
        category: "GENERAL MERCHANDISE",
      }),
      transaction({
        id: "gas-1",
        amount: 70,
        date: "2026-10-03",
        category: "Gas",
      }),
    ],
  }),
  [
    { category: "FOOD AND DRINK GROCERIES", amount: 100 },
    { category: "Groceries", amount: 90 },
    { category: "Shopping", amount: 40 },
    { category: "Gas", amount: 80 },
    { category: "Transfers", amount: 10 },
    { category: "Dining", amount: Number.NaN },
  ],
  reference,
);
assert.equal(over.length, 1);
assert.equal(over[0].id, "insight-budget-Groceries");
assert.match(over[0].detail, /\$110\.00 of confirmed Groceries expenses posted in 2026-10/);
assert.match(over[0].detail, /\$90\.00 limit/);
assert.match(over[0].detail, /\$20\.00 over/);

const lowerPaycheck = buildFinancialInsights(
  finance({
    viewerUserId: "user-a",
    incomePlan: {
      id: "plan",
      paySchedule: "biweekly",
      paycheckAmount: 2000,
      anchorDate: "2026-01-02",
      weeklyDayOfWeek: null,
      monthlyDays: [],
      customIntervalDays: null,
      depositAccountId: null,
      nextPayDate: "2026-10-16",
      lastProcessedDate: null,
      isActive: true,
      allocations: [],
    },
    transactions: [
      transaction({
        id: "pay-low",
        amount: 1500,
        type: "income",
        date: "2026-10-02",
        notes: "Payroll",
        category: "INCOME WAGES",
      }),
      transaction({
        id: "pay-close",
        amount: 1900,
        type: "income",
        date: "2026-09-18",
        notes: "Payroll",
        category: "INCOME WAGES",
      }),
      transaction({
        id: "pay-other",
        amount: 400,
        type: "income",
        date: "2026-10-08",
        notes: "Roommate payroll",
        category: "INCOME WAGES",
        ownerUserId: "user-b",
      }),
    ],
  }),
  reference,
);
const paycheckInsight = lowerPaycheck.find((item) => item.id === "insight-paycheck-pay-low");
assert.ok(paycheckInsight);
assert.equal(paycheckInsight.title, "A paycheck was lower than expected");
assert.match(paycheckInsight.detail, /\$1,500\.00 on 2026-10-02 is below your Income Plan amount of \$2,000\.00/);

const ranked = buildFinancialInsights(
  finance({
    accounts: [
      {
        id: "acct",
        name: "Checking",
        institution: "Bank",
        type: "checking",
        balance: 40,
        monthlyChange: 0,
      },
    ],
    bills: [
      {
        id: "rent",
        name: "Rent",
        amount: 50000,
        dueDay: 15,
        autopay: false,
        recurring: true,
        category: "Housing",
        paidMonth: null,
      },
    ],
    transactions: [
      transaction({ id: "aug", amount: 100, date: "2026-08-04", category: "Restaurants" }),
      transaction({ id: "sep", amount: 300, date: "2026-09-04", category: "Restaurants" }),
      transaction({ id: "oct", amount: 80, date: "2026-10-02", category: "Restaurants" }),
    ],
  }),
  reference,
  [{ category: "Restaurants", amount: 50 }],
);
assert.equal(ranked[0].id, "insight-bills-vs-cash");
assert.ok(ranked.some((item) => item.id === "insight-budget-Restaurants"));
assert.ok(ranked.findIndex((item) => item.id === "insight-budget-Restaurants") < ranked.findIndex((item) => item.id === "insight-spending-2026-09"));
assert.ok(ranked.length <= 6);
assert.equal(buildFinancialInsights(finance({}), reference).length, 0);

console.log("✅ Automation insight checks passed.");
