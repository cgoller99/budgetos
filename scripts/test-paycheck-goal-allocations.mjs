#!/usr/bin/env node
/**
 * Paycheck allocations can target real goals as dollars or percents.
 * Planning a contribution updates the forecast only. The saved balance
 * changes when the paycheck is confirmed.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { executePaycheckAllocations } from "../lib/allocation/paycheckEngine.ts";
import {
  getAllocationType,
  resolveAllocations,
} from "../lib/allocation/allocationEngine.ts";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";
import { paycheckWeeklyForGoal, getGoalContributionBreakdown } from "../lib/finance/goalAnalytics.ts";
import {
  completionDateKey,
  forecastGoalSavings,
  weeklySavingsFromPaycheckAmount,
} from "../lib/finance/goalForecast.ts";
import {
  applyAllocationInputs,
  getAllocationSummary,
  setAllocationModeOnDraft,
} from "../lib/incomePlan/allocations.ts";

const root = path.resolve(import.meta.dirname, "..");
const reference = new Date(2026, 9, 14, 12, 0, 0);

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
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

const house = {
  id: "goal-house",
  name: "House savings",
  type: "house",
  icon: "🏠",
  current: 1000,
  target: 5000,
  createdAt: "2026-01-01",
};
const vacation = {
  id: "goal-vacation",
  name: "Vacation",
  type: "vacation",
  icon: "✈️",
  current: 200,
  target: 1200,
  createdAt: "2026-01-01",
};
const emergency = {
  id: "goal-emergency",
  name: "Emergency fund",
  type: "emergency_fund",
  icon: "🛡️",
  current: 400,
  target: 2000,
  createdAt: "2026-01-01",
};

const exampleAllocations = [
  allocation({
    id: "house",
    name: "House savings",
    amount: 200,
    allocationType: "fixed",
    goalId: house.id,
    sortOrder: 0,
  }),
  allocation({
    id: "vacation",
    name: "Vacation",
    amount: 75,
    allocationType: "fixed",
    goalId: vacation.id,
    sortOrder: 1,
  }),
  allocation({
    id: "emergency",
    name: "Emergency fund",
    amount: 50,
    allocationType: "fixed",
    goalId: emergency.id,
    sortOrder: 2,
  }),
  allocation({
    id: "bills",
    name: "Bills",
    amount: 300,
    allocationType: "fixed",
    sortOrder: 3,
  }),
  allocation({
    id: "left",
    name: "Spending",
    allocationType: "remaining",
    isRemainingBalance: true,
    sortOrder: 4,
  }),
];

const examplePlan = {
  id: "plan",
  paySchedule: "biweekly",
  paycheckAmount: 880.66,
  anchorDate: "2026-10-02",
  weeklyDayOfWeek: 5,
  monthlyDays: [],
  customIntervalDays: null,
  depositAccountId: "checking",
  nextPayDate: "2026-10-16",
  lastProcessedDate: null,
  isActive: true,
  allocations: exampleAllocations,
};

const resolvedExample = resolveAllocations(examplePlan);
const byName = Object.fromEntries(
  resolvedExample.map((item) => [item.allocation.name, item.amount]),
);
assert.equal(byName["House savings"], 200);
assert.equal(byName.Vacation, 75);
assert.equal(byName["Emergency fund"], 50);
assert.equal(byName.Bills, 300);
assert.equal(byName.Spending, 255.66);

const exampleSummary = getAllocationSummary(880.66, exampleAllocations);
assert.equal(exampleSummary.allocated, 625);
assert.equal(exampleSummary.remaining, 255.66);
assert.equal(exampleSummary.isOverAllocated, false);

const percentRow = allocation({
  id: "pct",
  name: "Vacation",
  percentage: 10,
  allocationType: "percentage",
  goalId: vacation.id,
  sortOrder: 0,
});
const percentPlan = {
  ...examplePlan,
  allocations: [
    percentRow,
    allocation({
      id: "left",
      name: "Spending",
      allocationType: "remaining",
      isRemainingBalance: true,
      sortOrder: 1,
    }),
  ],
};
assert.equal(resolveAllocations(percentPlan)[0].amount, 88.07);
const percentSummary = getAllocationSummary(880.66, percentPlan.allocations);
assert.equal(percentSummary.allocated, 88.07);
assert.equal(percentSummary.remaining, 792.59);

const stalePercent = allocation({
  id: "stale",
  name: "House savings",
  amount: 999,
  percentage: 10,
  allocationType: "percentage",
  goalId: house.id,
});
const ignoredDollars = applyAllocationInputs(stalePercent, "200", "10");
assert.equal(ignoredDollars.allocationType, "percentage");
assert.equal(ignoredDollars.amount, null);
assert.equal(ignoredDollars.percentage, 10);
assert.equal(house.current, 1000);

const switched = setAllocationModeOnDraft(
  [stalePercent, exampleAllocations[4]],
  0,
  "fixed",
);
const editedDollars = applyAllocationInputs(switched[0], "200", "10");
assert.equal(editedDollars.allocationType, "fixed");
assert.equal(editedDollars.amount, 200);
assert.equal(editedDollars.percentage, null);
assert.equal(getAllocationType(switched[1]), "remaining");

const asRemaining = setAllocationModeOnDraft(
  [
    allocation({
      id: "fixed-row",
      name: "Bills",
      amount: 300,
      allocationType: "fixed",
    }),
    exampleAllocations[4],
  ],
  0,
  "remaining",
);
assert.equal(asRemaining[0].allocationType, "remaining");
assert.equal(asRemaining[0].isRemainingBalance, true);
assert.equal(asRemaining[0].amount, null);
assert.equal(asRemaining[1].allocationType, "fixed");
assert.equal(asRemaining[1].isRemainingBalance, false);

assert.equal(weeklySavingsFromPaycheckAmount(200, "biweekly"), 100);
assert.equal(weeklySavingsFromPaycheckAmount(200, "weekly"), 200);
assert.equal(weeklySavingsFromPaycheckAmount(216.5, "twice_monthly"), 100);

function forecastFor(perPaycheck) {
  const weekly = weeklySavingsFromPaycheckAmount(perPaycheck, "biweekly");
  return forecastGoalSavings({
    current: house.current,
    target: house.target,
    createdAt: house.createdAt,
    weeklySavings: weekly,
    contributed: 0,
    referenceDate: reference,
    paySchedule: "biweekly",
  });
}

const slower = forecastFor(200);
const faster = forecastFor(400);
assert.equal(slower.remaining, 4000);
assert.equal(slower.weeksRemaining, 40);
assert.match(slower.timeLabel, /40 weeks/);
assert.equal(faster.weeksRemaining, 20);
assert.notEqual(
  completionDateKey(slower.estimatedCompletionDate),
  completionDateKey(faster.estimatedCompletionDate),
);
assert.equal(house.current, 1000);

const finance = {
  ...emptyFinanceData,
  savingsGoals: [house, vacation, emergency],
  incomePlan: examplePlan,
  transactions: [],
};
assert.equal(paycheckWeeklyForGoal(finance, house.id), 100);
assert.equal(getGoalContributionBreakdown(finance, house).weeklyContribution, 100);
assert.equal(getGoalContributionBreakdown(finance, house).source, "income_plan");
assert.equal(paycheckWeeklyForGoal(finance, vacation.id), 37.5);

const raisedPlan = {
  ...examplePlan,
  allocations: examplePlan.allocations.map((item) =>
    item.goalId === house.id ? { ...item, amount: 400 } : item,
  ),
};
assert.equal(
  paycheckWeeklyForGoal({ ...finance, incomePlan: raisedPlan }, house.id),
  200,
);
assert.equal(house.current, 1000);

const checking = {
  id: "checking",
  name: "Checking",
  institution: "Bank",
  type: "checking",
  balance: 2000,
  monthlyChange: 0,
  includeInNetWorth: true,
  includeInSafeToSpend: true,
  isHidden: false,
};
const confirmData = {
  ...emptyFinanceData,
  accounts: [checking],
  savingsGoals: [house],
  incomePlan: {
    ...examplePlan,
    allocations: [exampleAllocations[0], exampleAllocations[4]],
  },
  transactions: [],
};
const confirmed = executePaycheckAllocations(
  confirmData,
  confirmData.incomePlan,
  {},
  reference,
);
assert.equal(house.current, 1000);
assert.equal(confirmData.savingsGoals[0].current, 1000);
assert.equal(confirmed.data.savingsGoals[0].current, 1200);
assert.equal(
  confirmed.resolvedAllocations.find((item) => item.allocation.goalId === house.id)
    .amount,
  200,
);

const incomePlan = read("components/incomePlan/IncomePlanContent.tsx");
const editor = read("components/incomePlan/PaycheckAllocationEditor.tsx");
const panel = read("components/goals/GoalForecastPanel.tsx");
assert.match(incomePlan, /Save allocations/);
assert.match(incomePlan, /keepSavedSchedule/);
assert.match(editor, /Add savings goal/);
assert.match(editor, /Saved balance/);
assert.match(editor, /Still to save/);
assert.match(editor, /Time remaining/);
assert.match(editor, /Percent/);
assert.match(editor, /Leftover/);
assert.match(editor, /data-paycheck-allocations/);
assert.doesNotMatch(incomePlan, /addMoneyToGoal/);
assert.doesNotMatch(incomePlan, /editGoal\(/);
assert.doesNotMatch(editor, /addMoneyToGoal/);
assert.match(panel, /draft \+ paycheckWeekly/);
assert.match(read("components/incomePlan/AllocationSummary.tsx"), /Left unallocated/);

const context = read("context/FinanceContext.tsx");
const saveStart = context.indexOf("const saveIncomePlan");
const saveEnd = context.indexOf("const markIncomePlanPaycheckReceived");
const saveFn = context.slice(saveStart, saveEnd);
assert.doesNotMatch(saveFn, /savingsGoals/);
assert.doesNotMatch(saveFn, /addMoneyToGoal/);

console.log("paycheck goal allocations ok");
