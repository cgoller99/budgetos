#!/usr/bin/env node
/**
 * Cash left until payday uses known bills and scheduled savings only.
 *
 * Usage: npm run test:cash-flow-forecast
 */
import assert from "node:assert/strict";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";
import { forecastCashUntilPayday } from "../lib/finance/cashFlowForecast.ts";
import { calculateMoneyFlow } from "../lib/finance/moneyFlow.ts";

const reference = new Date(2026, 9, 12, 12, 0, 0);

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

function bill(partial) {
  return {
    id: partial.id,
    name: partial.name,
    amount: partial.amount,
    dueDay: partial.dueDay,
    autopay: false,
    recurring: true,
    category: "Utilities",
    paidMonth: partial.paidMonth ?? null,
  };
}

const forecast = forecastCashUntilPayday(
  finance({
    incomePlan: {
      id: "plan",
      paySchedule: "biweekly",
      paycheckAmount: 2000,
      anchorDate: "2026-01-02",
      weeklyDayOfWeek: null,
      monthlyDays: [],
      customIntervalDays: null,
      depositAccountId: null,
      nextPayDate: "2026-10-30",
      lastProcessedDate: null,
      isActive: true,
      allocations: [],
    },
    bills: [
      bill({ id: "rent", name: "Rent", amount: 400, dueDay: 20 }),
      bill({ id: "later", name: "Insurance", amount: 90, dueDay: 31 }),
      bill({ id: "paid", name: "Phone", amount: 50, dueDay: 15, paidMonth: "2026-10" }),
    ],
    savingsGoals: [
      {
        id: "goal-active",
        name: "Trip",
        type: "vacation",
        icon: "✈️",
        current: 100,
        target: 1000,
        createdAt: "2026-01-01",
        autoContribution: {
          amount: 75,
          frequency: "weekly",
          schedule: {
            startDate: "2026-01-01",
            frequency: "weekly",
            nextOccurrence: "2026-10-20",
            lastProcessedDate: null,
            status: "active",
          },
        },
      },
      {
        id: "goal-paused",
        name: "Paused",
        type: "custom",
        icon: "🎯",
        current: 0,
        target: 500,
        createdAt: "2026-01-01",
        autoContribution: {
          amount: 200,
          frequency: "weekly",
          schedule: {
            startDate: "2026-01-01",
            frequency: "weekly",
            nextOccurrence: "2026-10-20",
            lastProcessedDate: null,
            status: "paused",
          },
        },
      },
    ],
  }),
  reference,
);

assert.equal(forecast.nextPayDate, "2026-10-30");
assert.equal(forecast.daysUntilPayday, 18);
assert.equal(forecast.availableCash, 1000);
assert.equal(forecast.billsDueBeforePayday, 400);
// Weekly $75 on 2026-10-20 and 2026-10-27 before payday 2026-10-30.
assert.equal(forecast.scheduledGoalSavings, 150);
assert.equal(forecast.safeUntilPayday, 450);
assert.equal(Object.hasOwn(forecast, "projectedReturn"), false);

const noPayday = forecastCashUntilPayday(
  finance({
    bills: [
      bill({ id: "soon", name: "Internet", amount: 60, dueDay: 20 }),
      bill({ id: "far", name: "Later", amount: 80, dueDay: 28 }),
    ],
  }),
  reference,
);
assert.equal(noPayday.nextPayDate, null);
assert.equal(noPayday.horizonDate, "2026-10-26");
assert.equal(noPayday.billsDueBeforePayday, 60);
assert.equal(noPayday.safeUntilPayday, 940);

const october = new Date(2026, 9, 15, 12, 0, 0);
const september = new Date(2026, 8, 15, 12, 0, 0);
const ledger = finance({
  transactions: [
    {
      id: "oct",
      amount: 30,
      type: "expense",
      category: "Groceries",
      accountId: "acct",
      transferAccountId: null,
      date: "2026-10-02",
      notes: "Store",
    },
    {
      id: "sep",
      amount: 80,
      type: "expense",
      category: "Groceries",
      accountId: "acct",
      transferAccountId: null,
      date: "2026-09-02",
      notes: "Store",
    },
  ],
});
assert.equal(calculateMoneyFlow(ledger, october).bills, 30);
assert.equal(calculateMoneyFlow(ledger, september).bills, 80);

console.log("Payday cash forecast checks passed.");
