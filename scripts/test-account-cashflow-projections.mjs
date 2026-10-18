#!/usr/bin/env node
/**
 * Real-expense account cashflow projections.
 * Usage: npm run test:account-cashflow-projections
 */
import assert from "node:assert/strict";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";
import {
  buildAccountCashflows,
  resolveStartingBalance,
  weeklyFromFrequency,
} from "../lib/budgets/accountCashflow.ts";
import { buildAccountForecasts } from "../lib/budgets/accountForecast.ts";

const OWNER = "owner-1";

function allocation(partial) {
  return {
    id: partial.id,
    name: partial.name,
    icon: partial.icon ?? "💵",
    amount: partial.amount ?? null,
    percentage: null,
    allocationType: "fixed",
    isRemainingBalance: false,
    accountId: partial.accountId ?? null,
    goalId: partial.goalId ?? null,
    billId: partial.billId ?? null,
    debtId: partial.debtId ?? null,
    investmentId: null,
    monthlyTarget: null,
    contributionFrequency: null,
    sortOrder: partial.sortOrder ?? 0,
  };
}

const savings = {
  id: "sav",
  name: "Savings",
  institution: "Bank",
  type: "savings",
  balance: 100,
  availableBalance: 100,
  monthlyChange: 0,
  lastSyncedAt: new Date().toISOString(),
  isPlaidLinked: true,
};
const billsAcct = {
  id: "bills",
  name: "Bills",
  institution: "Bank",
  type: "checking",
  balance: 500,
  availableBalance: 480,
  monthlyChange: 0,
  lastSyncedAt: new Date().toISOString(),
  isPlaidLinked: true,
};
const rentAcct = {
  id: "rent",
  name: "Investing",
  institution: "Bank",
  type: "checking",
  balance: 166,
  availableBalance: 166,
  monthlyChange: 0,
  lastSyncedAt: new Date().toISOString(),
  isPlaidLinked: true,
};
const spending = {
  id: "spend",
  name: "Spending",
  institution: "Bank",
  type: "checking",
  balance: 900,
  availableBalance: 900,
  monthlyChange: 0,
  lastSyncedAt: new Date().toISOString(),
  isPlaidLinked: true,
};

const data = {
  ...emptyFinanceData,
  viewerUserId: OWNER,
  accounts: [savings, billsAcct, rentAcct, spending],
  bills: [
    {
      id: "bill-util",
      name: "Utilities",
      amount: 110,
      dueDay: 5,
      autopay: false,
      recurring: true,
      category: "Utilities",
      paidMonth: null,
      frequency: "monthly",
      paymentAccountId: billsAcct.id,
    },
    {
      id: "bill-rent",
      name: "Apartment Rent",
      amount: 700,
      dueDay: 1,
      autopay: true,
      recurring: true,
      category: "Rent",
      paidMonth: null,
      frequency: "monthly",
      paymentAccountId: null, // should attribute to rent reserve account
    },
    {
      id: "bill-phone",
      name: "Verizon",
      amount: 80,
      dueDay: 2,
      autopay: false,
      recurring: true,
      category: "Utilities",
      paidMonth: null,
      frequency: "monthly",
      paymentAccountId: null, // should attribute to bills fund
    },
  ],
  debts: [
    {
      id: "debt-card",
      name: "Visa",
      balance: 1000,
      originalBalance: 1200,
      interestRate: 19.9,
      minimumPayment: 43.33, // ~$10/week
      monthlyChange: 0,
      dueDay: 15,
      accountType: "credit_card",
    },
  ],
  incomePlan: {
    id: "plan",
    paySchedule: "weekly",
    paycheckAmount: 885.27,
    anchorDate: "2026-10-03",
    weeklyDayOfWeek: 5,
    monthlyDays: [1, 15],
    customIntervalDays: null,
    depositAccountId: spending.id,
    nextPayDate: "2026-10-24",
    lastProcessedDate: null,
    isActive: true,
    ownerUserId: OWNER,
    allocations: [
      allocation({
        id: "a-house",
        name: "House Savings",
        amount: 350.27,
        accountId: savings.id,
        goalId: "g1",
        sortOrder: 0,
      }),
      allocation({
        id: "a-rent",
        name: "Rent Reserve",
        amount: 175,
        accountId: rentAcct.id,
        sortOrder: 1,
      }),
      allocation({
        id: "a-bills",
        name: "Bills",
        amount: 110,
        accountId: billsAcct.id,
        sortOrder: 2,
      }),
      allocation({
        id: "a-spend",
        name: "Personal Spending",
        amount: 250,
        accountId: spending.id,
        sortOrder: 3,
      }),
    ],
  },
  savingsGoals: [
    {
      id: "g1",
      name: "House",
      type: "emergency",
      icon: "🏠",
      current: 100,
      target: 10000,
      createdAt: "2026-01-01",
    },
  ],
  incomePlanPaychecks: [],
  transactions: [],
  plaidRecurringDismissals: [],
};

console.log("1) Available balance preferred over ledger");
const start = resolveStartingBalance(billsAcct);
assert.equal(start.kind, "available");
assert.equal(start.amount, 480);

console.log("2) Weekly frequency helper uses 4.33 weeks/month");
assert.equal(weeklyFromFrequency(433, "monthly"), 100);

console.log("3) Cashflows include paycheck, transfers, bills, rent, debt, spending");
const flows = buildAccountCashflows(data);
const spendFlow = flows.get(spending.id);
assert.ok(spendFlow);
assert.ok(spendFlow.lines.some((line) => line.kind === "paycheck"));
assert.ok(spendFlow.lines.some((line) => line.kind === "transfer_out"));
assert.ok(spendFlow.lines.some((line) => line.kind === "spending"));
assert.ok(spendFlow.lines.some((line) => line.kind === "debt"));
// Deposit account should not endlessly grow from paycheck alone.
assert.ok(spendFlow.weeklyOutflows >= spendFlow.weeklyInflows - 0.01);

console.log("4) Bills account: known bill + unassigned phone attributed to bills fund");
const billsFlow = flows.get(billsAcct.id);
assert.ok(billsFlow);
assert.ok(billsFlow.upcomingWithdrawals.some((line) => /Utilities/i.test(line.name)));
assert.ok(billsFlow.upcomingWithdrawals.some((line) => /Verizon/i.test(line.name)));
assert.ok(billsFlow.weeklyOutflows > 0);

console.log("5) Rent reserve does not accumulate forever when rent bill exists");
const rentFlow = flows.get(rentAcct.id);
assert.ok(rentFlow);
assert.ok(rentFlow.upcomingWithdrawals.some((line) => line.kind === "rent"));
assert.ok(Math.abs(rentFlow.weeklyNet) < rentFlow.weeklyInflows);

console.log("6) Savings still grows from planned contributions only");
const savFlow = flows.get(savings.id);
assert.ok(savFlow);
assert.equal(savFlow.weeklyInflows, 350.27);
assert.equal(savFlow.weeklyOutflows, 0);

console.log("7) Forecast projections use available balance and real outflows");
const forecasts = buildAccountForecasts(data);
const billsForecast = forecasts.accounts.find((item) => item.accountId === billsAcct.id);
assert.ok(billsForecast);
assert.equal(billsForecast.currentBalance, 480); // available, not ledger 500
assert.ok(billsForecast.upcomingWithdrawals.length > 0);
assert.ok(billsForecast.weeklyPlannedWithdrawals > 0);
const at3m = billsForecast.horizons.find((item) => item.id === "3m");
assert.ok(at3m);
// Should not project as if only deposits land with zero bills.
assert.ok(at3m.plannedWithdrawals > 0);
assert.ok(
  at3m.projectedBalance <
    billsForecast.currentBalance + billsForecast.weeklyPlannedDeposits * 13,
);

console.log("8) Internal transfers are labeled, not expenses");
assert.ok(
  spendFlow.lines.some(
    (line) => line.kind === "transfer_out" && /House Savings/i.test(line.name),
  ),
);

console.log("✅ Account cashflow projection checks passed.");
