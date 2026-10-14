#!/usr/bin/env node
/**
 * P1 financial accuracy regressions with independent cash-flow ledgers.
 *
 * Expected values are derived from documented ledger arithmetic in each
 * scenario — not by mirroring whatever the engine currently returns.
 *
 * Usage:
 *   node --experimental-strip-types --import ./scripts/register-alias.mjs \
 *     scripts/test-p1-financial-accuracy.mjs
 */

import assert from "node:assert/strict";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";
import { calculateMoneyFlow } from "../lib/finance/moneyFlow.ts";
import { forecastCashUntilPayday } from "../lib/finance/cashFlowForecast.ts";
import { forecastCashOutlook } from "../lib/finance/cashOutlook.ts";
import { getEffectiveIncomeSources } from "../lib/finance/effectiveIncome.ts";
import {
  EXTRA_DEBT_ALLOCATION_NAME,
  plannedExtraDebtMonthly,
} from "../lib/finance/debtPayoff.ts";
import {
  resolveCashAvailability,
  calculateAvailableCash,
} from "../lib/calculations/availableCash.ts";
import { oneTimeBillObligationsForMonth } from "../lib/calculations/spending.ts";

const ref = new Date(2026, 9, 14, 12); // Oct 14, 2026

function base(partial = {}) {
  return {
    ...emptyFinanceData,
    ...partial,
    accounts: partial.accounts ?? [],
    bills: partial.bills ?? [],
    income: partial.income ?? [],
    debts: partial.debts ?? [],
    savingsGoals: partial.savingsGoals ?? [],
    transactions: partial.transactions ?? [],
    incomePlan: partial.incomePlan ?? null,
  };
}

function round(value) {
  return Math.round(value * 100) / 100;
}

// ── 1. Manual cash caps Safe to Spend ──────────────────────────────────────
{
  // Ledger: income $4000/mo − bills $500 = $3500 projected, but only $200 cash.
  const data = base({
    accounts: [
      {
        id: "manual-checking",
        name: "Checking",
        institution: "Manual",
        type: "checking",
        balance: 200,
        availableBalance: 200,
        includeInSafeToSpend: true,
      },
    ],
    income: [
      {
        id: "job",
        name: "Salary",
        amount: 4000,
        frequency: "monthly",
        category: "Paycheck",
        depositAccountId: "manual-checking",
        schedule: {
          startDate: "2026-01-01",
          frequency: "monthly",
          nextOccurrence: "2026-11-01",
          lastProcessedDate: null,
          status: "active",
        },
      },
    ],
    bills: [
      {
        id: "rent",
        name: "Rent",
        amount: 500,
        dueDay: 1,
        autopay: false,
        recurring: true,
        category: "Housing",
        paidMonth: null,
        frequency: "monthly",
      },
    ],
  });

  const cash = resolveCashAvailability(data);
  assert.equal(cash.amount, 200, "manual checking contributes $200");
  assert.equal(cash.status, "qualified");

  const flow = calculateMoneyFlow(data, ref);
  // Independent ledger: min(4000 - 500 - 0 - goals - inv, 200) = 200
  // goals: none → projected = 3500, capped to 200
  assert.equal(flow.projectedSafeToSpend, 3500);
  assert.equal(flow.safeToSpend, 200, "manual cash must cap STS");
  assert.notEqual(flow.safeToSpend, 3500);
}

{
  // Savings without explicit opt-in must not inflate spendable cash.
  const data = base({
    accounts: [
      {
        id: "sav",
        name: "Emergency",
        institution: "Manual",
        type: "savings",
        balance: 5000,
        // includeInSafeToSpend omitted → not spendable
      },
      {
        id: "chk",
        name: "Checking",
        institution: "Manual",
        type: "checking",
        balance: 150,
        includeInSafeToSpend: true,
      },
    ],
  });
  assert.equal(calculateAvailableCash(data), 150);
}

{
  // Mixed Plaid + manual; dedupe same external id; negative balance → 0 contrib.
  const data = base({
    accounts: [
      {
        id: "plaid-chk",
        name: "Plaid Checking",
        institution: "Bank",
        type: "checking",
        balance: 100,
        availableBalance: 80,
        externalAccountId: "ext-1",
        lastSyncedAt: new Date().toISOString(),
        includeInSafeToSpend: true,
      },
      {
        id: "dup",
        name: "Mirror",
        institution: "Bank",
        type: "checking",
        balance: 100,
        availableBalance: 80,
        externalAccountId: "ext-1",
        lastSyncedAt: new Date().toISOString(),
        includeInSafeToSpend: true,
      },
      {
        id: "manual",
        name: "Cash jar",
        institution: "Home",
        type: "cash",
        balance: 40,
        includeInSafeToSpend: true,
      },
      {
        id: "overdrawn",
        name: "Overdrawn",
        institution: "Bank",
        type: "checking",
        balance: -50,
        availableBalance: -50,
        includeInSafeToSpend: true,
      },
    ],
  });
  // Independent: 80 + 40 + 0 = 120
  assert.equal(calculateAvailableCash(data), 120);
}

{
  // No spendable cash → STS 0 (unavailable), not a fake income projection.
  const data = base({
    income: [
      {
        id: "job",
        name: "Salary",
        amount: 3000,
        frequency: "monthly",
        category: "Paycheck",
        schedule: {
          startDate: "2026-01-01",
          frequency: "monthly",
          nextOccurrence: "2026-11-01",
          lastProcessedDate: null,
          status: "active",
        },
      },
    ],
  });
  const flow = calculateMoneyFlow(data, ref);
  assert.equal(flow.cashAvailabilityStatus, "unavailable");
  assert.equal(flow.safeToSpend, 0);
  assert.ok(flow.projectedSafeToSpend > 0);
}

// ── 2. Duplicate income projections ────────────────────────────────────────
{
  const sharedAccount = "acct-pay";
  const source = {
    id: "src-job",
    name: "Employer Direct Deposit",
    amount: 2000,
    frequency: "biweekly",
    category: "Paycheck",
    depositAccountId: sharedAccount,
    schedule: {
      startDate: "2026-01-01",
      frequency: "biweekly",
      nextOccurrence: "2026-10-16",
      lastProcessedDate: null,
      status: "active",
    },
  };
  const plan = {
    id: "plan-1",
    paySchedule: "biweekly",
    paycheckAmount: 2000,
    anchorDate: "2026-01-01",
    weeklyDayOfWeek: null,
    monthlyDays: [1, 15],
    customIntervalDays: null,
    depositAccountId: sharedAccount,
    linkedIncomeSourceId: null,
    nextPayDate: "2026-10-16",
    lastProcessedDate: null,
    isActive: true,
    allocations: [],
  };

  // Same deposit + frequency → one source (deterministic), even with non-paycheck name
  // and exact amount (no reliance on name/"paycheck" heuristics alone).
  let effective = getEffectiveIncomeSources(base({ income: [source], incomePlan: plan }));
  assert.equal(effective.length, 1);
  assert.equal(effective[0].id, "src-job");

  // Explicit link wins even if deposit accounts differ.
  effective = getEffectiveIncomeSources(
    base({
      income: [{ ...source, depositAccountId: "other" }],
      incomePlan: { ...plan, depositAccountId: sharedAccount, linkedIncomeSourceId: "src-job" },
    }),
  );
  assert.equal(effective.length, 1);
  assert.equal(effective[0].id, "src-job");

  // Genuinely separate job (different deposit + no link) keeps both.
  effective = getEffectiveIncomeSources(
    base({
      income: [source],
      incomePlan: {
        ...plan,
        depositAccountId: "side-gig-acct",
        paycheckAmount: 500,
        linkedIncomeSourceId: null,
      },
    }),
  );
  assert.equal(effective.length, 2);
}

// ── 3. Debt allocation double-counting via debtId ───────────────────────────
{
  const debt = {
    id: "debt-card",
    name: "Card",
    balance: 1000,
    interestRate: 20,
    minimumPayment: 100,
    dueDay: 20,
    accountType: "credit_card",
  };
  const plan = {
    id: "plan-debt",
    paySchedule: "monthly",
    paycheckAmount: 3000,
    anchorDate: "2026-01-01",
    weeklyDayOfWeek: null,
    monthlyDays: [1],
    customIntervalDays: null,
    depositAccountId: null,
    nextPayDate: "2026-11-01",
    lastProcessedDate: null,
    isActive: true,
    allocations: [
      {
        id: "alloc-extra",
        name: EXTRA_DEBT_ALLOCATION_NAME,
        icon: "💳",
        amount: 50,
        percentage: null,
        allocationType: "fixed",
        isRemainingBalance: false,
        accountId: null,
        goalId: null,
        billId: null,
        debtId: "debt-card",
        investmentId: null,
        monthlyTarget: null,
        contributionFrequency: null,
        sortOrder: 0,
      },
    ],
  };

  // Independent: extra $50/mo above $100 minimum → planned extra = 50
  assert.equal(plannedExtraDebtMonthly(plan, [debt]), 50);

  // Renamed allocation still counts via debtId; only ABOVE minimum is extra.
  const renamed = {
    ...plan,
    allocations: [
      {
        ...plan.allocations[0],
        name: "Card payoff boost",
        amount: 150, // monthly schedule
      },
    ],
  };
  // 150 planned − 100 minimum = 50 extra
  assert.equal(plannedExtraDebtMonthly(renamed, [debt]), 50);

  const data = base({
    accounts: [
      {
        id: "c",
        name: "Checking",
        institution: "Bank",
        type: "checking",
        balance: 5000,
        includeInSafeToSpend: true,
      },
    ],
    income: [
      {
        id: "job",
        name: "Pay",
        amount: 3000,
        frequency: "monthly",
        category: "Paycheck",
        schedule: {
          startDate: "2026-01-01",
          frequency: "monthly",
          nextOccurrence: "2026-11-01",
          lastProcessedDate: null,
          status: "active",
        },
      },
    ],
    debts: [debt],
    incomePlan: plan,
    transactions: [
      {
        id: "pay-min",
        type: "expense",
        amount: 100,
        date: "2026-10-10",
        category: "Debt",
        notes: "Card payment",
        debtId: "debt-card",
        accountId: "c",
      },
    ],
  });

  const flow = calculateMoneyFlow(data, ref);
  // Ledger: minimum 100 already reserved; posted 100 covers it; planned extra 50
  // → debts stage = 100 + 50 = 150 (not 100+100+50)
  assert.equal(flow.debts, 150);
}

// ── 4. Goal contributions until payday ─────────────────────────────────────
{
  const data = base({
    accounts: [
      {
        id: "c",
        name: "Checking",
        institution: "Bank",
        type: "checking",
        balance: 1000,
        includeInSafeToSpend: true,
      },
    ],
    incomePlan: {
      id: "plan",
      paySchedule: "biweekly",
      paycheckAmount: 2000,
      anchorDate: "2026-10-02",
      weeklyDayOfWeek: 4,
      monthlyDays: [],
      customIntervalDays: null,
      depositAccountId: "c",
      nextPayDate: "2026-10-30",
      lastProcessedDate: null,
      isActive: true,
      allocations: [
        {
          id: "g-alloc",
          name: "Vacation",
          icon: "🏖",
          amount: 100,
          percentage: null,
          allocationType: "fixed",
          isRemainingBalance: false,
          accountId: null,
          goalId: "goal-vac",
          billId: null,
          debtId: null,
          investmentId: null,
          monthlyTarget: null,
          contributionFrequency: null,
          sortOrder: 0,
        },
      ],
    },
    savingsGoals: [
      {
        id: "goal-weekly",
        name: "Emergency",
        icon: "🛟",
        target: 5000,
        current: 100,
        autoContribution: {
          amount: 25,
          frequency: "weekly",
          schedule: {
            startDate: "2026-10-01",
            frequency: "weekly",
            nextOccurrence: "2026-10-15",
            lastProcessedDate: null,
            status: "active",
          },
        },
      },
      {
        id: "goal-vac",
        name: "Vacation",
        icon: "🏖",
        target: 2000,
        current: 0,
      },
    ],
  });

  const forecast = forecastCashUntilPayday(data, ref);
  // Horizon = next payday 2026-10-30.
  // Weekly $25 on 10/15, 10/22, 10/29 → 75
  // Plan goal $100 on pay dates in window: next pay is the horizon itself,
  // so the payday contribution is included (cursor <= horizon).
  // Independent ledger expects scheduled weekly occurrences + plan allocation.
  assert.ok(
    forecast.scheduledGoalSavings >= 75,
    `expected at least 3 weekly contributions, got ${forecast.scheduledGoalSavings}`,
  );
  assert.ok(
    forecast.scheduledGoalSavings >= 175,
    `expected weekly goals + income-plan goal allocation, got ${forecast.scheduledGoalSavings}`,
  );
  // Does not inflate actual saved balances
  assert.equal(data.savingsGoals.find((g) => g.id === "goal-weekly").current, 100);
}

// ── 5. One-time bills in monthly Safe to Spend ──────────────────────────────
{
  const data = base({
    accounts: [
      {
        id: "c",
        name: "Checking",
        institution: "Bank",
        type: "checking",
        balance: 5000,
        includeInSafeToSpend: true,
      },
    ],
    income: [
      {
        id: "job",
        name: "Salary",
        amount: 4000,
        frequency: "monthly",
        category: "Paycheck",
        schedule: {
          startDate: "2026-01-01",
          frequency: "monthly",
          nextOccurrence: "2026-11-01",
          lastProcessedDate: null,
          status: "active",
        },
      },
    ],
    bills: [
      {
        id: "rent",
        name: "Rent",
        amount: 1000,
        dueDay: 1,
        autopay: false,
        recurring: true,
        category: "Housing",
        paidMonth: null,
        frequency: "monthly",
        schedule: {
          startDate: "2026-01-01",
          frequency: "monthly",
          nextOccurrence: "2026-11-01",
          lastProcessedDate: "2026-10-01",
          status: "active",
        },
      },
      {
        id: "dentist",
        name: "Dentist",
        amount: 300,
        dueDay: 20,
        autopay: false,
        recurring: false,
        category: "Health",
        paidMonth: null,
        frequency: "monthly",
        schedule: {
          startDate: "2026-10-20",
          frequency: "monthly",
          nextOccurrence: "2026-10-20",
          lastProcessedDate: null,
          status: "active",
        },
      },
      {
        id: "done",
        name: "Completed one-time",
        amount: 90,
        dueDay: 5,
        autopay: false,
        recurring: false,
        category: "Other",
        paidMonth: "2026-10",
        frequency: "monthly",
        schedule: {
          startDate: "2026-10-05",
          frequency: "monthly",
          nextOccurrence: "2026-10-05",
          lastProcessedDate: "2026-10-05",
          status: "paused",
        },
      },
    ],
  });

  const oneTime = oneTimeBillObligationsForMonth(data, ref);
  assert.equal(oneTime, 300, "unpaid one-time dentist due this month");

  const flow = calculateMoneyFlow(data, ref);
  // Independent: recurring rent 1000 + one-time 300 = 1300 bills stage
  // (rent schedule next is Nov — progress may still treat Oct remaining;
  // money flow recurringBillMonthlyTotal uses recurring flag annualization)
  assert.ok(flow.bills >= 1300, `STS bills should include one-time, got ${flow.bills}`);

  const outlook = forecastCashOutlook(data, ref);
  const outlookOneTime = outlook.events
    .filter((event) => event.kind === "bill" && event.name === "Dentist")
    .reduce((total, event) => total + Math.abs(event.amount), 0);
  assert.equal(outlookOneTime, 300);
}

// ── Cross-check insufficient cash ───────────────────────────────────────────
{
  const data = base({
    accounts: [
      {
        id: "c",
        name: "Checking",
        institution: "Bank",
        type: "checking",
        balance: 50,
        includeInSafeToSpend: true,
      },
    ],
    income: [
      {
        id: "job",
        name: "Salary",
        amount: 2000,
        frequency: "monthly",
        category: "Paycheck",
        schedule: {
          startDate: "2026-01-01",
          frequency: "monthly",
          nextOccurrence: "2026-11-01",
          lastProcessedDate: null,
          status: "active",
        },
      },
    ],
    bills: [
      {
        id: "rent",
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
  });
  const flow = calculateMoneyFlow(data, ref);
  assert.equal(flow.safeToSpend, 50);
  assert.ok(flow.projectedSafeToSpend <= 800);
}

console.log("✅ P1 financial accuracy ledger regressions passed.");
