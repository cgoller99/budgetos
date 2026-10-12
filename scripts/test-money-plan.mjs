#!/usr/bin/env node
/**
 * Money Plan reads the current engines and does not move money.
 *
 * Usage: npm run test:money-plan
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";
import { getSafeToSpend } from "../lib/finance/safeToSpend.ts";
import { buildMoneyPlan } from "../lib/plan/moneyPlan.ts";

const reference = new Date(2026, 9, 12, 12, 0, 0);
const root = path.resolve(import.meta.dirname, "..");

function finance(partial) {
  return {
    ...emptyFinanceData,
    accounts: [
      {
        id: "acct",
        name: "Checking",
        institution: "Bank",
        type: "checking",
        balance: 1000,
        monthlyChange: 0,
      },
    ],
    ...partial,
  };
}

const data = finance({
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
    ownerUserId: "user-a",
    allocations: [
      {
        id: "rent-alloc",
        name: "Rent",
        icon: "🏠",
        amount: 400,
        isRemainingBalance: false,
        accountId: null,
        goalId: null,
        monthlyTarget: null,
        sortOrder: 0,
      },
      {
        id: "rest",
        name: "Spending",
        icon: "🛍️",
        amount: null,
        isRemainingBalance: true,
        accountId: null,
        goalId: null,
        monthlyTarget: null,
        sortOrder: 1,
      },
    ],
  },
  bills: [
    {
      id: "rent",
      name: "Rent",
      amount: 400,
      dueDay: 20,
      autopay: false,
      recurring: true,
      category: "Rent",
      paidMonth: null,
    },
    {
      id: "phone",
      name: "Phone",
      amount: 50,
      dueDay: 15,
      autopay: false,
      recurring: true,
      category: "Utilities",
      paidMonth: "2026-10",
    },
  ],
  debts: [
    {
      id: "visa",
      name: "Visa",
      balance: 800,
      originalBalance: 1000,
      interestRate: 0,
      minimumPayment: 50,
      monthlyChange: 0,
      dueDay: 25,
      accountType: "credit_card",
    },
  ],
  savingsGoals: [
    {
      id: "goal-1",
      name: "Emergency fund",
      type: "emergency_fund",
      icon: "🛟",
      current: 400,
      target: 1000,
      createdAt: "2026-01-01",
    },
  ],
  transactions: [
    {
      id: "g1",
      amount: 80,
      type: "expense",
      category: "FOOD AND DRINK GROCERIES",
      accountId: "acct",
      transferAccountId: null,
      date: "2026-10-03",
      notes: "Market",
    },
    {
      id: "g2",
      amount: -20,
      type: "expense",
      category: "FOOD AND DRINK GROCERIES",
      accountId: "acct",
      transferAccountId: null,
      date: "2026-10-04",
      notes: "Market refund",
    },
    {
      id: "xfer",
      amount: 300,
      type: "transfer",
      category: "Transfers",
      accountId: "acct",
      transferAccountId: null,
      date: "2026-10-04",
      notes: "Transfer to savings",
    },
    {
      id: "other",
      amount: 500,
      type: "expense",
      category: "FOOD AND DRINK GROCERIES",
      accountId: "acct",
      transferAccountId: null,
      date: "2026-10-04",
      notes: "Roommate",
      ownerUserId: "user-b",
    },
  ],
});

const plan = buildMoneyPlan(
  data,
  reference,
  [
    { category: "FOOD AND DRINK GROCERIES", amount: 100 },
    { category: "Groceries", amount: 50 },
    { category: "Transfers", amount: 10 },
  ],
);

assert.equal(plan.safeToSpend, getSafeToSpend(data, reference));
assert.equal(plan.month, "2026-10");
assert.equal(plan.incomePlan.paycheckAmount, 2000);
assert.equal(plan.incomePlan.nextPayDate, "2026-10-16");
assert.equal(plan.incomePlan.allocations[1].amountLabel, "Remainder of the paycheck");
assert.equal(plan.bills.some((bill) => bill.name === "Phone"), false);
assert.equal(plan.bills.some((bill) => bill.name === "Rent"), true);
assert.equal(plan.debtMinimums, 50);
assert.equal(plan.debts[0].name, "Visa");
assert.equal(plan.goals.length, 1);
assert.equal(plan.goals[0].remaining, 600);
assert.equal(Object.hasOwn(plan.goals[0], "estimatedCompletionDate"), false);
assert.equal(plan.budgets.length, 1);
assert.equal(plan.budgets[0].category, "Groceries");
assert.equal(plan.budgets[0].limit, 50);
assert.equal(plan.budgets[0].spent, 60);
assert.equal(plan.budgets[0].over, true);
assert.match(plan.budgets[0].detail, /confirmed Groceries expenses posted in 2026-10/);

const hidden = buildMoneyPlan(
  finance({
    viewerUserId: "user-a",
    incomePlan: {
      ...data.incomePlan,
      ownerUserId: "user-b",
    },
  }),
  reference,
);
assert.equal(hidden.incomePlan, null);

const plans = fs.readFileSync(path.join(root, "lib/subscription/plans.ts"), "utf8");
const screen = fs.readFileSync(path.join(root, "components/plan/MoneyPlanContent.tsx"), "utf8");
const engine = fs.readFileSync(path.join(root, "lib/plan/moneyPlan.ts"), "utf8");
assert.match(plans, /PRO_PLUS_ROUTE_PREFIXES = \[\]/);
assert.match(screen, /does not move money/);
assert.match(screen, /ProUpgradeBanner/);
assert.doesNotMatch(screen, /executePaycheck|markIncomePlan/);
assert.doesNotMatch(engine, /remaining \/ 12|GOAL_ALLOCATION/);
assert.doesNotMatch(engine, /executePaycheck|markIncomePlan/);

console.log("Money Plan checks passed.");
