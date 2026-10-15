#!/usr/bin/env node
/**
 * Cross-feature Income Plan contract:
 * Weekly $1000 → bills $300, house $200, vacation $50, debt extra $100 → $350 left.
 * Raising house to $250 → $300 left. Actual savings balances unchanged until confirm.
 *
 * Usage: npm run test:unified-financial-plan
 */
import assert from "node:assert/strict";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";
import { forecastCashUntilPayday } from "../lib/finance/cashFlowForecast.ts";
import { plannedExtraDebtMonthly } from "../lib/finance/debtPayoff.ts";
import { EXTRA_DEBT_ALLOCATION_NAME } from "../lib/finance/debtPayoff.ts";
import { getGoalContributionBreakdown } from "../lib/finance/goalAnalytics.ts";
import { calculateMoneyFlow } from "../lib/finance/moneyFlow.ts";
import { calculateMoneyLeftUntilPayday } from "../lib/finance/moneyLeftUntilPayday.ts";
import { buildPaycheckPlanSummary } from "../lib/finance/paycheckPlanSummary.ts";
import { getSafeToSpend } from "../lib/finance/safeToSpend.ts";
import {
  buildUnifiedFinancialPlan,
  plannedGoalWeekly,
} from "../lib/finance/unifiedFinancialPlan.ts";

const reference = new Date(2026, 9, 15, 12, 0, 0);

function allocation(partial) {
  return {
    id: partial.id,
    name: partial.name,
    icon: partial.icon ?? "💵",
    amount: partial.amount ?? null,
    percentage: partial.percentage ?? null,
    allocationType: partial.allocationType ?? "fixed",
    isRemainingBalance: partial.isRemainingBalance ?? false,
    accountId: null,
    goalId: partial.goalId ?? null,
    billId: partial.billId ?? null,
    debtId: partial.debtId ?? null,
    investmentId: null,
    monthlyTarget: null,
    contributionFrequency: null,
    sortOrder: partial.sortOrder ?? 0,
  };
}

const house = {
  id: "goal-house",
  name: "House",
  type: "house",
  icon: "🏠",
  current: 1000,
  target: 20000,
  createdAt: "2026-01-01",
};
const vacation = {
  id: "goal-vacation",
  name: "Vacation",
  type: "vacation",
  icon: "✈️",
  current: 200,
  target: 2000,
  createdAt: "2026-01-01",
};
const card = {
  id: "debt-card",
  name: "Credit Card",
  balance: 2500,
  originalBalance: 3000,
  interestRate: 19.9,
  minimumPayment: 75,
  monthlyChange: 0,
  dueDay: 12,
  accountType: "credit_card",
};

function buildPlan(houseAmount) {
  return {
    id: "plan-weekly",
    paySchedule: "weekly",
    paycheckAmount: 1000,
    anchorDate: "2026-10-10",
    weeklyDayOfWeek: 5,
    monthlyDays: [],
    customIntervalDays: null,
    depositAccountId: "chk",
    nextPayDate: "2026-10-17",
    lastProcessedDate: null,
    isActive: true,
    ownerUserId: "user-a",
    allocations: [
      allocation({
        id: "alloc-bills",
        name: "Bills",
        amount: 300,
        billId: "bill-rent",
        sortOrder: 0,
      }),
      allocation({
        id: "alloc-house",
        name: "House",
        amount: houseAmount,
        goalId: house.id,
        sortOrder: 1,
      }),
      allocation({
        id: "alloc-vacation",
        name: "Vacation",
        amount: 50,
        goalId: vacation.id,
        sortOrder: 2,
      }),
      allocation({
        id: "alloc-debt",
        name: EXTRA_DEBT_ALLOCATION_NAME,
        amount: 100,
        debtId: card.id,
        icon: "💳",
        sortOrder: 3,
      }),
      allocation({
        id: "alloc-left",
        name: "Spending",
        allocationType: "remaining",
        isRemainingBalance: true,
        sortOrder: 4,
      }),
    ],
  };
}

function finance(houseAmount) {
  return {
    ...emptyFinanceData,
    viewerUserId: "user-a",
    accounts: [
      {
        id: "chk",
        name: "Checking",
        institution: "Bank",
        type: "checking",
        balance: 800,
        monthlyChange: 0,
        includeInNetWorth: true,
        includeInSafeToSpend: true,
        isHidden: false,
      },
    ],
    income: [
      {
        id: "job",
        name: "Job",
        amount: 1000,
        frequency: "weekly",
        category: "Payroll",
        depositAccountId: "chk",
      },
    ],
    bills: [
      {
        id: "bill-rent",
        name: "Rent",
        amount: 1200,
        dueDay: 1,
        autopay: false,
        recurring: true,
        category: "Housing",
        paidMonth: null,
        frequency: "monthly",
      },
    ],
    savingsGoals: [
      { ...house },
      { ...vacation },
    ],
    debts: [{ ...card }],
    incomePlan: buildPlan(houseAmount),
    transactions: [],
  };
}

function assertScenario(data, expectedUnallocated, housePaycheck) {
  const paycheck = buildPaycheckPlanSummary(data);
  assert.ok(paycheck);
  assert.equal(paycheck.expectedPaycheck, 1000);
  assert.equal(paycheck.billsAllocated, 300);
  assert.equal(paycheck.savingsGoalAllocations, housePaycheck + 50);
  assert.equal(paycheck.extraDebtPayments, 100);
  assert.equal(paycheck.remainingUnallocated, expectedUnallocated);

  const unified = buildUnifiedFinancialPlan(data);
  assert.equal(unified.remainingUnallocated, expectedUnallocated);
  assert.equal(plannedGoalWeekly(data, house.id), housePaycheck);
  assert.equal(plannedGoalWeekly(data, vacation.id), 50);

  const houseBreakdown = getGoalContributionBreakdown(data, house);
  const vacationBreakdown = getGoalContributionBreakdown(data, vacation);
  assert.equal(houseBreakdown.weeklyContribution, housePaycheck);
  assert.equal(vacationBreakdown.weeklyContribution, 50);
  assert.equal(houseBreakdown.source, "income_plan");

  const extraDebt = plannedExtraDebtMonthly(data.incomePlan, data.debts);
  // Weekly $100 → monthly (100 * 52) / 12
  assert.equal(extraDebt, Math.round(((100 * 52) / 12) * 100) / 100);

  // Actual balances unchanged by planning
  assert.equal(data.savingsGoals.find((g) => g.id === house.id).current, 1000);
  assert.equal(data.savingsGoals.find((g) => g.id === vacation.id).current, 200);
  assert.equal(data.debts[0].balance, 2500);

  const moneyLeft = calculateMoneyLeftUntilPayday(data, reference);
  assert.ok(Number.isFinite(moneyLeft.moneyLeftAfterCommitments));
  assert.ok(moneyLeft.plannedSavingsCommitments >= housePaycheck + 50);

  const sts = getSafeToSpend(data, reference);
  const flow = calculateMoneyFlow(data, reference);
  // Cash ceiling: $800 checking — STS must never exceed eligible cash
  assert.ok(sts <= 800);
  assert.equal(flow.availableCash, 800);
  assert.ok(flow.safeToSpend <= flow.availableCash);

  // Budget remaining is not cash — unused category limits must not raise STS
  assert.ok(sts <= moneyLeft.availableCash);

  const payday = forecastCashUntilPayday(data, reference);
  assert.ok(payday.safeUntilPayday <= payday.availableCash);
}

// Baseline: $350 unallocated
{
  const data = finance(200);
  assertScenario(data, 350, 200);
  const sum =
    300 + 200 + 50 + 100 + buildPaycheckPlanSummary(data).remainingUnallocated;
  assert.equal(sum, 1000);
}

// Raise house to $250 → $300 unallocated; balances still unchanged
{
  const data = finance(250);
  assertScenario(data, 300, 250);
  assert.equal(data.savingsGoals.find((g) => g.id === house.id).current, 1000);
}

// Negative cash still cash-caps STS
{
  const data = finance(200);
  data.accounts[0].balance = -50;
  const sts = getSafeToSpend(data, reference);
  assert.equal(sts, 0);
}

// Missing plan → graceful empty unified plan
{
  const data = finance(200);
  data.incomePlan = null;
  const unified = buildUnifiedFinancialPlan(data);
  assert.equal(unified.hasActivePlan, false);
  assert.equal(unified.remainingUnallocated, 0);
}

console.log("✅ Unified financial plan cross-feature checks passed.");
