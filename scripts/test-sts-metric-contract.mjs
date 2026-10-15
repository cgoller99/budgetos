#!/usr/bin/env node
/**
 * Safe to Spend metric contract: until-payday vs weekly allowance must stay distinct
 * and customer-facing "before paycheck" insights must use cash-capped until-payday.
 */
import assert from "node:assert/strict";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";
import { forecastCashUntilPayday } from "../lib/finance/cashFlowForecast.ts";
import { calculateMoneyFlow } from "../lib/finance/moneyFlow.ts";
import { getSafeToSpend, getSafeToSpendWeekly } from "../lib/finance/safeToSpend.ts";
import {
  calculateSafeToSpendBeforePaycheck,
  calculateWeeklySpendingAllowance,
} from "../lib/intelligence/calculations.ts";
import { generateWeeklyPlan } from "../lib/intelligence/generateWeeklyPlan.ts";

const ref = new Date(2026, 9, 14, 12);

function withCash(balance, extras = {}) {
  return {
    ...emptyFinanceData,
    accounts: [
      {
        id: "chk",
        name: "Checking",
        type: "checking",
        balance,
        includeInSafeToSpend: true,
        availableBalance: extras.availableBalance,
        externalAccountId: extras.externalAccountId ?? null,
        lastSyncedAt: extras.lastSyncedAt ?? null,
      },
    ],
    bills: extras.bills ?? [],
    debts: extras.debts ?? [],
    savingsGoals: extras.goals ?? [],
    income: extras.income ?? [
      {
        id: "inc",
        name: "Job",
        amount: 1000,
        frequency: "biweekly",
        category: "Paycheck",
        depositAccountId: "chk",
        schedule: {
          startDate: "2026-10-01",
          frequency: "biweekly",
          nextOccurrence: "2026-10-28",
          status: "active",
        },
      },
    ],
    incomePlan: extras.incomePlan ?? {
      id: "plan",
      paySchedule: "biweekly",
      paycheckAmount: 1000,
      anchorDate: "2026-10-01",
      weeklyDayOfWeek: 5,
      monthlyDays: [],
      customIntervalDays: null,
      depositAccountId: "chk",
      linkedIncomeSourceId: "inc",
      nextPayDate: "2026-10-15",
      lastProcessedDate: null,
      isActive: true,
      allocations: [],
    },
  };
}

// Manual checking $200 — until payday matches insight; weekly is separate
{
  const data = withCash(200);
  const payday = forecastCashUntilPayday(data, ref);
  const insight = calculateSafeToSpendBeforePaycheck(data, ref);
  const weekly = calculateWeeklySpendingAllowance(data, ref);
  const monthly = getSafeToSpend(data, ref);

  assert.equal(payday.availableCash, 200);
  assert.equal(payday.safeUntilPayday, 200);
  assert.equal(insight, payday.safeUntilPayday);
  assert.equal(weekly, getSafeToSpendWeekly(data, ref));
  assert.equal(monthly, calculateMoneyFlow(data, ref).safeToSpend);
  assert.ok(insight <= 200);
  assert.notEqual(insight, weekly);

  const recommendations = generateWeeklyPlan(data, ref);
  const stsRec = recommendations.find((row) => row.id === "safe-to-spend");
  assert.ok(stsRec, "expected until-payday insight");
  assert.match(stsRec.message, /\$200\.00/);
  assert.doesNotMatch(stsRec.message, /\$46/);
}

// Plaid checking with available balance $200
{
  const data = withCash(250, {
    availableBalance: 200,
    externalAccountId: "plaid-1",
    lastSyncedAt: new Date().toISOString(),
  });
  assert.equal(calculateSafeToSpendBeforePaycheck(data, ref), 200);
}

// Upcoming bill before payday reduces until-payday cash
{
  const data = withCash(200, {
    bills: [
      {
        id: "bill-1",
        name: "Phone",
        amount: 40,
        dueDay: 14,
        autopay: false,
        recurring: true,
        category: "Utilities",
        paidMonth: null,
        frequency: "monthly",
      },
    ],
  });
  const insight = calculateSafeToSpendBeforePaycheck(data, ref);
  const payday = forecastCashUntilPayday(data, ref);
  assert.equal(insight, payday.safeUntilPayday);
  assert.ok(insight <= 200);
}

// Negative cash → until payday does not invent spendable cash
{
  const data = withCash(-50);
  assert.equal(calculateSafeToSpendBeforePaycheck(data, ref), 0);
}

// Missing spendable cash
{
  const data = {
    ...emptyFinanceData,
    accounts: [
      {
        id: "sav",
        name: "Savings",
        type: "savings",
        balance: 500,
        includeInSafeToSpend: false,
      },
    ],
    incomePlan: withCash(0).incomePlan,
  };
  assert.equal(calculateSafeToSpendBeforePaycheck(data, ref), 0);
}

console.log("✅ STS metric contract regressions passed.");
