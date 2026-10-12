#!/usr/bin/env node
/**
 * 30-day cash outlook starts from confirmed cash and does not double-count
 * bills, transfers, debt payments, or goal allocations.
 *
 * Usage: npm run test:cash-outlook
 */
import assert from "node:assert/strict";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";
import { describeCashOutlook, forecastCashOutlook } from "../lib/finance/cashOutlook.ts";

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
        balance: partial.balance ?? 1000,
        monthlyChange: 0,
      },
    ],
    ...partial,
  };
}

function expense(partial) {
  return {
    id: partial.id,
    amount: partial.amount,
    type: partial.type ?? "expense",
    category: partial.category ?? "Subscriptions",
    accountId: "acct",
    transferAccountId: null,
    date: partial.date,
    notes: partial.notes ?? "",
    billId: partial.billId ?? null,
    goalId: partial.goalId ?? null,
    debtId: partial.debtId ?? null,
    ownerUserId: partial.ownerUserId ?? null,
  };
}

function allocation(partial) {
  return {
    id: partial.id,
    name: partial.name,
    icon: "•",
    amount: partial.amount,
    isRemainingBalance: false,
    accountId: null,
    goalId: partial.goalId ?? null,
    billId: partial.billId ?? null,
    debtId: partial.debtId ?? null,
    monthlyTarget: null,
    sortOrder: partial.sortOrder,
  };
}

const outlook = forecastCashOutlook(
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
      nextPayDate: "2026-10-16",
      lastProcessedDate: null,
      isActive: true,
      allocations: [
        allocation({
          id: "alloc-buffer",
          name: "Buffer",
          amount: 100,
          goalId: "goal-buffer",
          sortOrder: 0,
        }),
        allocation({
          id: "alloc-trip",
          name: "Trip",
          amount: 50,
          goalId: "goal-active",
          sortOrder: 1,
        }),
        allocation({
          id: "alloc-rent",
          name: "Rent",
          amount: 400,
          billId: "rent",
          sortOrder: 2,
        }),
        allocation({
          id: "alloc-medical",
          name: "Medical",
          amount: 30,
          debtId: "medical",
          sortOrder: 3,
        }),
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
        id: "insurance",
        name: "Insurance",
        amount: 100,
        dueDay: 5,
        autopay: false,
        recurring: true,
        category: "Insurance",
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
      {
        id: "rent-debt",
        name: "Rent",
        balance: 400,
        originalBalance: 400,
        interestRate: 0,
        minimumPayment: 400,
        monthlyChange: 0,
        dueDay: 20,
        accountType: "other",
      },
      {
        id: "medical",
        name: "Medical",
        balance: 300,
        originalBalance: 300,
        interestRate: 0,
        minimumPayment: 30,
        monthlyChange: 0,
        dueDay: 0,
        accountType: "medical",
      },
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
        id: "goal-buffer",
        name: "Buffer",
        type: "custom",
        icon: "💰",
        current: 0,
        target: 500,
        createdAt: "2026-01-01",
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
    transactions: [
      expense({ id: "nflx-1", amount: 15.99, date: "2026-09-05", notes: "Netflix" }),
      expense({ id: "nflx-2", amount: 15.99, date: "2026-10-05", notes: "Netflix" }),
      expense({
        id: "card-1",
        amount: 100,
        date: "2026-09-02",
        notes: "Payment thank you",
        category: "Credit Card Payment",
      }),
      expense({
        id: "card-2",
        amount: 100,
        date: "2026-10-02",
        notes: "Payment thank you",
        category: "Credit Card Payment",
      }),
      expense({
        id: "xfer-1",
        amount: 250,
        date: "2026-09-01",
        notes: "Online transfer to savings",
        category: "Transfers",
        type: "transfer",
      }),
      expense({
        id: "xfer-2",
        amount: 250,
        date: "2026-10-01",
        notes: "Online transfer to savings",
        category: "Transfers",
        type: "transfer",
      }),
    ],
  }),
  reference,
);

function total(kind) {
  return Math.round(
    outlook.events
      .filter((event) => event.kind === kind)
      .reduce((sum, event) => sum + event.amount, 0) * 100,
  ) / 100;
}

assert.equal(outlook.horizonDays, 30);
assert.equal(outlook.startDate, "2026-10-12");
assert.equal(outlook.endDate, "2026-11-11");
assert.equal(outlook.availableCash, 1000);
assert.equal(outlook.availableCashConfidence, "confirmed");
assert.equal(total("paycheck"), 6000);
assert.equal(total("bill"), -600);
assert.equal(total("goal"), -600);
assert.equal(total("debt"), -140);
assert.equal(total("recurring"), -15.99);
assert.equal(outlook.endingCash, 5644.01);
assert.equal(outlook.lowBalance.date, "2026-10-12");
assert.equal(outlook.lowBalance.amount, 900);
assert.equal(outlook.shortfalls.length, 0);
assert.ok(outlook.events.every((event) => event.confidence === "estimated"));
assert.ok(outlook.events.every((event) => event.detail.length > 20));
assert.equal(outlook.events.some((event) => event.name === "Phone"), false);
assert.equal(outlook.events.some((event) => event.name === "Paused"), false);
assert.equal(
  outlook.events.filter((event) => event.kind === "debt" && event.name === "Rent").length,
  0,
);
assert.equal(
  outlook.events.filter((event) => event.name === "Trip" && event.kind === "goal").length,
  4,
);
assert.equal(outlook.events.some((event) => /transfer/i.test(event.name)), false);
assert.equal(outlook.events.some((event) => /thank you/i.test(event.name)), false);
assert.equal(Object.hasOwn(outlook, "projectedReturn"), false);
assert.match(describeCashOutlook(outlook) ?? "", /30-day low of \$900\.00 on Mon, Oct 12/);
assert.match(describeCashOutlook(outlook) ?? "", /Opening cash is confirmed/);

const short = forecastCashOutlook(
  finance({
    balance: 50,
    bills: [
      {
        id: "rent",
        name: "Rent",
        amount: 200,
        dueDay: 20,
        autopay: false,
        recurring: true,
        category: "Rent",
        paidMonth: null,
      },
    ],
  }),
  reference,
);
assert.equal(short.shortfalls.length, 1);
assert.equal(short.shortfalls[0].date, "2026-10-20");
assert.equal(short.shortfalls[0].amount, -150);
assert.match(short.shortfalls[0].detail, /confirmed/);
assert.match(short.shortfalls[0].detail, /estimates/);
assert.equal(short.lowBalance.amount, -150);
assert.match(describeCashOutlook(short) ?? "", /Possible shortfall of \$150\.00 on Tue, Oct 20/);

const sameDay = forecastCashOutlook(
  finance({
    balance: 100,
    incomePlan: {
      id: "plan",
      paySchedule: "biweekly",
      paycheckAmount: 50,
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
    bills: [
      {
        id: "utilities",
        name: "Utilities",
        amount: 120,
        dueDay: 16,
        autopay: false,
        recurring: false,
        category: "Utilities",
        paidMonth: null,
      },
    ],
  }),
  reference,
);
assert.equal(sameDay.shortfalls.length, 0);
assert.equal(sameDay.lowBalance.amount, 30);
assert.equal(sameDay.lowBalance.date, "2026-10-16");

const paidDebt = forecastCashOutlook(
  finance({
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
    transactions: [
      expense({
        id: "visa-paid",
        amount: 50,
        date: "2026-10-01",
        notes: "Visa",
        category: "Credit Card Payment",
        debtId: "visa",
      }),
    ],
  }),
  reference,
);
assert.equal(paidDebt.events.some((event) => event.kind === "debt"), false);

const otherHousehold = forecastCashOutlook(
  finance({
    viewerUserId: "user-a",
    transactions: [
      expense({
        id: "other-1",
        amount: 15.99,
        date: "2026-09-05",
        notes: "Netflix",
        ownerUserId: "user-b",
      }),
      expense({
        id: "other-2",
        amount: 15.99,
        date: "2026-10-05",
        notes: "Netflix",
        ownerUserId: "user-b",
      }),
    ],
  }),
  reference,
);
assert.equal(otherHousehold.events.length, 0);

console.log("30-day cash outlook checks passed.");
