#!/usr/bin/env node
/**
 * Budget hub, money-left, paycheck summary, and goal What-If contracts.
 * Usage: npm run test:budget-hub-goals
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildBudgetHubSummary } from "../lib/budgets/budgetHub.ts";
import { buildCategoryBudgetViews } from "../lib/budgets/categoryBudgets.ts";
import {
  previousPeriodSurplus,
  readBudgetRolloverCategories,
  writeBudgetRolloverCategories,
} from "../lib/budgets/budgetRollover.ts";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";
import { simulateGoalWhatIf } from "../lib/finance/goalWhatIf.ts";
import {
  buildGoalHorizonProjections,
  projectGoalBalanceAtHorizon,
} from "../lib/finance/goalHorizon.ts";
import {
  calculateMoneyLeftUntilPayday,
  plannedSavingsUntilPayday,
} from "../lib/finance/moneyLeftUntilPayday.ts";
import { buildPaycheckPlanSummary } from "../lib/finance/paycheckPlanSummary.ts";

const root = path.resolve(import.meta.dirname, "..");

function on(year, month, day) {
  return new Date(year, month - 1, day, 12, 0, 0);
}

function allocation(partial) {
  return {
    id: partial.id,
    name: partial.name,
    icon: partial.icon ?? "💵",
    amount: partial.amount ?? null,
    percentage: partial.percentage ?? null,
    allocationType: partial.allocationType ?? null,
    isRemainingBalance: partial.isRemainingBalance ?? false,
    accountId: null,
    goalId: partial.goalId ?? null,
    billId: null,
    debtId: null,
    investmentId: null,
    monthlyTarget: null,
    contributionFrequency: null,
    sortOrder: partial.sortOrder ?? 0,
  };
}

function finance(partial = {}) {
  return {
    ...emptyFinanceData,
    accounts: [
      {
        id: "acct",
        name: "Checking",
        institution: "Bank",
        type: "checking",
        balance: 2400,
        monthlyChange: 0,
        includeInNetWorth: true,
        includeInSafeToSpend: true,
        isHidden: false,
      },
    ],
    viewerUserId: "user-a",
    income: [
      {
        id: "job",
        name: "Job",
        amount: 2000,
        frequency: "biweekly",
        category: "Payroll",
      },
    ],
    incomePlan: {
      id: "plan",
      paySchedule: "biweekly",
      paycheckAmount: 2000,
      anchorDate: "2026-10-10",
      weeklyDayOfWeek: 5,
      monthlyDays: [],
      customIntervalDays: null,
      depositAccountId: "acct",
      nextPayDate: "2026-10-24",
      lastProcessedDate: null,
      isActive: true,
      ownerUserId: "user-a",
      allocations: [
        allocation({
          id: "alloc-goal",
          name: "House",
          amount: 200,
          allocationType: "fixed",
          goalId: "goal-1",
          sortOrder: 0,
        }),
        allocation({
          id: "alloc-remain",
          name: "Remaining",
          allocationType: "remaining",
          isRemainingBalance: true,
          sortOrder: 1,
        }),
      ],
    },
    savingsGoals: [
      {
        id: "goal-1",
        name: "House",
        icon: "🏠",
        type: "house",
        current: 500,
        target: 5000,
        createdAt: "2026-01-01",
      },
    ],
    bills: [],
    debts: [],
    transactions: [],
    ...partial,
  };
}

const reference = on(2026, 10, 15);
const data = finance();
const views = buildCategoryBudgetViews(
  [
    {
      category: "Groceries",
      amount: 150,
      frequency: "weekly",
      anchorDate: "2026-10-13",
      weekday: 1,
    },
    { category: "Shopping", amount: 200, frequency: "monthly" },
  ],
  data,
  reference,
);
const hub = buildBudgetHubSummary(views, data, reference);
assert.ok(hub.safeToSpend >= 0);
assert.equal(typeof hub.explanation, "string");
assert.match(hub.explanation, /not extra cash/i);
assert.ok(hub.totalRemainingBudgetAllowance >= 0);

const moneyLeft = calculateMoneyLeftUntilPayday(data, reference);
assert.equal(typeof moneyLeft.moneyLeftAfterCommitments, "number");
assert.ok(plannedSavingsUntilPayday(data, reference) >= 200);

const paycheck = buildPaycheckPlanSummary(data);
assert.ok(paycheck);
assert.equal(paycheck.expectedPaycheck, 2000);
assert.equal(paycheck.savingsGoalAllocations, 200);
assert.equal(paycheck.remainingUnallocated, 1800);

const whatIf = simulateGoalWhatIf({
  current: 500,
  target: 5000,
  createdAt: "2026-01-01",
  baselineWeeklySavings: 50,
  contributed: 500,
  paySchedule: "biweekly",
  extraWeekly: 10,
  oneTimeContribution: 100,
});
assert.equal(whatIf.oneTimeApplied, 100);
assert.ok(whatIf.weeklySavingsUsed >= 60);
assert.ok(whatIf.simulated.remaining < whatIf.baseline.remaining);

const horizons = buildGoalHorizonProjections({
  current: 500,
  target: 5000,
  weeklySavings: 100,
});
assert.equal(horizons.length, 4);
const thirty = projectGoalBalanceAtHorizon({
  current: 500,
  target: 5000,
  weeklySavings: 100,
  days: 30,
});
assert.ok(thirty.expectedAdded > 0);
assert.ok(thirty.expectedBalance <= 5000);

assert.equal(previousPeriodSurplus(100, 40), 60);
assert.equal(previousPeriodSurplus(100, 140), 0);

const memory = new Map();
const storage = {
  getItem(key) {
    return memory.has(key) ? memory.get(key) : null;
  },
  setItem(key, value) {
    memory.set(key, value);
  },
};
writeBudgetRolloverCategories(storage, "user-a", new Set(["Groceries"]));
assert.ok(readBudgetRolloverCategories(storage, "user-a").has("Groceries"));

const rolled = buildCategoryBudgetViews(
  [
    {
      category: "Groceries",
      amount: 100,
      frequency: "weekly",
      weekday: 1,
      anchorDate: "2026-10-13",
    },
  ],
  finance({
    transactions: [
      {
        id: "prev",
        amount: 20,
        type: "expense",
        category: "Groceries",
        accountId: "acct",
        transferAccountId: null,
        date: "2026-10-06",
        notes: "",
        ownerUserId: "user-a",
      },
    ],
  }),
  reference,
  { rolloverCategories: new Set(["Groceries"]) },
);
assert.ok(rolled[0].rolloverEnabled);
assert.ok(rolled[0].effectiveLimit >= rolled[0].limit);

const nav = fs.readFileSync(path.join(root, "lib/navigation.ts"), "utf8");
assert.match(nav, /href: "\/budgets"/);
assert.match(nav, /label: "Budgets"/);
assert.ok(fs.existsSync(path.join(root, "app/(authenticated)/budgets/page.tsx")));
assert.ok(fs.existsSync(path.join(root, "components/budgets/BudgetsContent.tsx")));
assert.ok(fs.existsSync(path.join(root, "components/goals/GoalWhatIfPanel.tsx")));

console.log("✅ Budget hub + goals integration checks passed.");
