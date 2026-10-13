#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { executePaycheckAllocations } from "../lib/allocation/paycheckEngine.ts";
import { detectPaycheckSuggestions } from "../lib/automation/detectPaycheck.ts";
import {
  buildPaycheckReviews,
  classifyUpcomingPaycheck,
  paycheckReviewSuggestionId,
  resolveAuthorizedPaycheckInput,
  shouldDeferScheduledPaycheck,
} from "../lib/automation/paycheckReview.ts";
import { plaidAutomationProvider } from "../lib/automation/providers/plaidAutomationProvider.ts";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";

const reference = new Date("2026-10-11T15:00:00Z");

function income(partial) {
  return {
    id: partial.id,
    amount: partial.amount,
    type: partial.type ?? "income",
    category: partial.category ?? "Paycheck",
    accountId: partial.accountId ?? "checking",
    transferAccountId: null,
    date: partial.date,
    notes: partial.notes ?? "",
    goalId: null,
    billId: null,
    externalTransactionId: partial.externalTransactionId ?? `ext-${partial.id}`,
  };
}

function plan(overrides = {}) {
  return {
    id: "plan",
    paySchedule: "biweekly",
    paycheckAmount: 2000,
    anchorDate: "2026-01-02",
    weeklyDayOfWeek: null,
    monthlyDays: [],
    customIntervalDays: null,
    depositAccountId: "checking",
    nextPayDate: "2026-10-16",
    lastProcessedDate: null,
    isActive: true,
    allocations: [
      {
        id: "rent",
        name: "Rent",
        icon: "🏠",
        amount: 800,
        percentage: null,
        allocationType: "fixed",
        isRemainingBalance: false,
        accountId: null,
        goalId: null,
        billId: null,
        debtId: null,
        investmentId: null,
        monthlyTarget: null,
        contributionFrequency: null,
        sortOrder: 0,
      },
      {
        id: "left",
        name: "Left to spend",
        icon: "✨",
        amount: null,
        percentage: null,
        allocationType: "remaining",
        isRemainingBalance: true,
        accountId: null,
        goalId: null,
        billId: null,
        debtId: null,
        investmentId: null,
        monthlyTarget: null,
        contributionFrequency: null,
        sortOrder: 1,
      },
    ],
    ...overrides,
  };
}

function finance(overrides = {}) {
  return {
    ...emptyFinanceData,
    accounts: [
      {
        id: "checking",
        name: "Checking",
        institution: "Bank",
        type: "checking",
        balance: 4000,
        monthlyChange: 0,
      },
    ],
    incomePlan: plan(),
    ...overrides,
  };
}

const matched = finance({
  income: [
    {
      id: "src-acme",
      name: "Acme Corp",
      amount: 2000,
      frequency: "biweekly",
      category: "Paycheck",
      depositAccountId: "checking",
    },
  ],
  transactions: [
    income({
      id: "internal-1",
      amount: 2000,
      date: "2026-10-10",
      notes: "ACH PAYROLL ACME CORP",
      externalTransactionId: "plaid-ext-1",
    }),
    income({
      id: "refund-1",
      amount: 2000,
      date: "2026-10-10",
      category: "Refund",
      notes: "AMAZON REFUND",
    }),
    income({
      id: "paypal-1",
      amount: 2000,
      date: "2026-10-09",
      category: "Transfers",
      notes: "PAYPAL TRANSFER",
    }),
    income({
      id: "old-1",
      amount: 2000,
      date: "2026-09-01",
      notes: "ACH PAYROLL ACME CORP",
    }),
  ],
});

const reviews = buildPaycheckReviews(matched, reference);
assert.equal(reviews.length, 1);
const review = reviews[0];
assert.equal(review.transactionId, "internal-1");
assert.equal(review.merchant, "Payroll Acme Corp");
assert.equal(review.actualAmount, 2000);
assert.equal(review.expectedAmount, 2000);
assert.equal(review.planAmount, 2000);
assert.equal(review.frequencyLabel, "Every two weeks");
assert.equal(review.expectedPayDate, "2026-10-16");
assert.equal(review.matchedSourceName, "Acme Corp");
assert.equal(review.confidence, "likely");
assert.equal(review.canApply, true);
assert.deepEqual(
  review.allocations.map((item) => [item.name, item.amount]),
  [
    ["Rent", 800],
    ["Left to spend", 1200],
  ],
);

const suggestions = detectPaycheckSuggestions(matched, reference);
assert.equal(suggestions.length, 1);
assert.equal(suggestions[0].id, paycheckReviewSuggestionId("internal-1"));
assert.equal(suggestions[0].primaryAction.payload.transactionId, "internal-1");
assert.notEqual(suggestions[0].primaryAction.payload.transactionId, "plaid-ext-1");
assert.match(suggestions[0].description, /until you confirm/i);
assert.match(suggestions[0].description, /Payroll Acme Corp/);
assert.match(suggestions[0].description, /Every two weeks/);
assert.equal(shouldDeferScheduledPaycheck(matched, reference), true);

const plaidSuggestions = plaidAutomationProvider.getSuggestions(matched, reference);
assert.equal(
  plaidSuggestions.some((item) => item.kind === "paycheck_detected"),
  false,
);

const linked = finance({
  transactions: [
    income({
      id: "internal-1",
      amount: 2000,
      date: "2026-10-10",
      notes: "ACH PAYROLL ACME CORP",
    }),
  ],
  incomePlanPaychecks: [
    {
      id: "event-1",
      incomePlanId: "plan",
      payDate: "2026-10-02",
      grossAmount: 2000,
      isExtraPaycheck: false,
      incomeTransactionId: "internal-1",
      allocationEvents: [],
    },
  ],
});
assert.equal(buildPaycheckReviews(linked, reference).length, 0);

const recentEvent = finance({
  transactions: [
    income({
      id: "internal-2",
      amount: 2000,
      date: "2026-10-11",
      notes: "ACH PAYROLL ACME CORP",
    }),
  ],
  incomePlanPaychecks: [
    {
      id: "event-2",
      incomePlanId: "plan",
      payDate: "2026-10-10",
      grossAmount: 2000,
      isExtraPaycheck: false,
      incomeTransactionId: null,
      allocationEvents: [],
    },
  ],
});
assert.equal(buildPaycheckReviews(recentEvent, reference).length, 0);
assert.equal(shouldDeferScheduledPaycheck(recentEvent, reference), false);

const otherHousehold = finance({
  viewerUserId: "user-a",
  incomePlan: plan({ paycheckAmount: 2000 }),
  income: [
    {
      id: "src-other",
      name: "Side Gig",
      amount: 640,
      frequency: "monthly",
      category: "Paycheck",
      ownerUserId: "user-b",
    },
  ],
  transactions: [
    income({
      id: "gig-1",
      amount: 640,
      date: "2026-10-10",
      notes: "SIDE GIG",
      category: "Income",
    }),
  ],
});
assert.equal(buildPaycheckReviews(otherHousehold, reference).length, 0);

const sourceSized = finance({
  incomePlan: plan(),
  income: [
    {
      id: "src-acme",
      name: "Acme Corp",
      amount: 1800,
      frequency: "biweekly",
      category: "Paycheck",
    },
  ],
  transactions: [
    income({
      id: "sized-1",
      amount: 1800,
      date: "2026-10-08",
      notes: "ACME CORP PAYROLL",
    }),
  ],
});
const sizedReview = buildPaycheckReviews(sourceSized, reference)[0];
assert.equal(sizedReview.matchedSourceName, "Acme Corp");
assert.equal(sizedReview.actualAmount, 1800);
assert.equal(sizedReview.expectedAmount, 1800);
assert.equal(sizedReview.planAmount, 2000);
assert.equal(sizedReview.canApply, true);
assert.equal(sizedReview.allocations[0].amount, 800);
assert.match(detectPaycheckSuggestions(sourceSized, reference)[0].description, /Your plan is/);

const noPlan = finance({
  incomePlan: null,
  income: [
    {
      id: "src-acme",
      name: "Acme Corp",
      amount: 2000,
      frequency: "biweekly",
      category: "Paycheck",
    },
  ],
  transactions: [
    income({
      id: "internal-1",
      amount: 2000,
      date: "2026-10-10",
      notes: "ACH PAYROLL ACME CORP",
    }),
  ],
});
const unmatchedPlan = buildPaycheckReviews(noPlan, reference);
assert.equal(unmatchedPlan.length, 1);
assert.equal(unmatchedPlan[0].canApply, false);
assert.equal(unmatchedPlan[0].allocations.length, 0);
assert.equal(detectPaycheckSuggestions(noPlan, reference).length, 0);
assert.equal(shouldDeferScheduledPaycheck(noPlan, reference), false);

assert.equal(
  classifyUpcomingPaycheck(finance({ transactions: [] }), reference).lifecycle,
  "expected",
);
assert.equal(classifyUpcomingPaycheck(matched, reference).lifecycle, "received");

const appliedData = finance({
  incomePlan: plan({ nextPayDate: "2026-10-10", lastProcessedDate: "2026-10-10" }),
  incomePlanPaychecks: [
    {
      id: "event-applied",
      incomePlanId: "plan",
      payDate: "2026-10-10",
      grossAmount: 2000,
      isExtraPaycheck: false,
      incomeTransactionId: "internal-1",
      allocationEvents: [],
    },
  ],
  transactions: [
    income({
      id: "internal-1",
      amount: 2000,
      date: "2026-10-10",
      notes: "ACH PAYROLL ACME CORP",
    }),
  ],
});
assert.equal(classifyUpcomingPaycheck(appliedData, reference).lifecycle, "applied");

const depositData = finance({
  transactions: [
    income({
      id: "dep-1",
      amount: 2000,
      date: "2026-10-10",
      notes: "ACH PAYROLL ACME CORP",
    }),
  ],
});
const linkedApply = executePaycheckAllocations(
  depositData,
  depositData.incomePlan,
  {},
  reference,
);
assert.equal(linkedApply.paycheckEvent.incomeTransactionId, "dep-1");
assert.equal(
  linkedApply.data.transactions.filter((transaction) => transaction.type === "income").length,
  1,
);

assert.throws(
  () =>
    executePaycheckAllocations(
      {
        ...depositData,
        incomePlanPaychecks: linkedApply.data.incomePlanPaychecks,
      },
      depositData.incomePlan,
      {},
      reference,
    ),
  /already applied/,
);

const manualApply = executePaycheckAllocations(
  finance({ transactions: [] }),
  finance().incomePlan,
  {},
  reference,
);
assert.equal(
  manualApply.data.transactions.filter((transaction) =>
    transaction.notes?.includes("Income Plan paycheck received"),
  ).length,
  1,
);

const twoDeposits = finance({
  transactions: [
    income({
      id: "dep-a",
      amount: 2000,
      date: "2026-10-10",
      notes: "ACH PAYROLL ACME",
    }),
    income({
      id: "dep-b",
      amount: 2000,
      date: "2026-10-09",
      notes: "ACH PAYROLL ACME",
    }),
  ],
});
assert.throws(
  () => resolveAuthorizedPaycheckInput(twoDeposits, {}, reference),
  /Confirm which deposit/,
);

const prompt = fs.readFileSync(
  new URL("../components/incomePlan/PaycheckDetectedPrompt.tsx", import.meta.url),
  "utf8",
);
assert.match(prompt, /sourceTransactionId: item\.transactionId/);
assert.doesNotMatch(prompt, /runIncomePlan\(\)/);

const context = fs.readFileSync(
  new URL("../context/FinanceContext.tsx", import.meta.url),
  "utf8",
);
assert.doesNotMatch(context, /Paycheck plan applied/);
assert.doesNotMatch(context, /markIncomePlanPaycheckReceived\(\)/);

const cron = fs.readFileSync(
  new URL("../lib/cron/paycheckCronService.ts", import.meta.url),
  "utf8",
);
assert.doesNotMatch(cron, /markIncomePlanPaycheckReceived/);

console.log("paycheck review ok");
