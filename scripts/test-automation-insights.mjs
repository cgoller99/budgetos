#!/usr/bin/env node
import assert from "node:assert/strict";
import { merchantGroupKey, normalizeMerchantKey } from "../lib/bills/merchantMatch.ts";
import {
  buildMerchantCategoryMemory,
  categoryForSyncedTransaction,
} from "../lib/automation/categoryMemory.ts";
import {
  buildFinancialInsights,
  findSubscriptionPriceIncreases,
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

console.log("✅ Automation insight checks passed.");
