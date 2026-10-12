#!/usr/bin/env node
import assert from "node:assert/strict";
import { detectRecurringBillSuggestions } from "../lib/automation/detectRecurringBills.ts";
import {
  billCategoryForKind,
  buildRecurringReview,
  classifyRecurringKind,
  isRecurringDismissalCurrent,
  recurringEquivalents,
  recurringEvidenceKey,
  recurringPriceChange,
} from "../lib/automation/recurringReview.ts";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";
import { detectRecurringBillCandidatesFromFinanceData } from "../lib/plaid/recurringBillDetection.ts";

const reference = new Date("2026-10-11T12:00:00");

function transaction(partial) {
  return {
    id: partial.id,
    amount: partial.amount,
    type: "expense",
    category: partial.category ?? "Subscriptions",
    accountId: "checking",
    transferAccountId: null,
    date: partial.date,
    notes: partial.notes,
    billId: null,
    goalId: null,
    externalTransactionId: partial.id,
  };
}

function finance(transactions, bills = []) {
  return {
    ...emptyFinanceData,
    accounts: [
      {
        id: "checking",
        name: "Checking",
        institution: "Bank",
        type: "checking",
        balance: 1000,
        monthlyChange: 0,
      },
    ],
    bills,
    transactions,
  };
}

assert.equal(
  classifyRecurringKind({ merchantKey: "netflix", category: "Entertainment" }),
  "subscription",
);
assert.equal(
  classifyRecurringKind({ merchantKey: "geico", category: "Bills" }),
  "insurance",
);
assert.equal(
  classifyRecurringKind({ merchantKey: "georgia power", category: "Bills" }),
  "utility",
);
assert.equal(
  classifyRecurringKind({ merchantKey: "planet fitness", category: "Entertainment" }),
  "membership",
);
assert.equal(
  classifyRecurringKind({ merchantKey: "honda finance", category: "Loans" }),
  "loan",
);
assert.equal(
  classifyRecurringKind({ merchantKey: "whole foods", category: "Groceries" }),
  "other",
);
assert.equal(billCategoryForKind("membership"), "Memberships");
assert.equal(billCategoryForKind("loan"), "Loans");

const weekly = recurringEquivalents(10, "weekly");
assert.equal(weekly.monthly, 43.33);
assert.equal(weekly.annual, 519.96);

const monthly = recurringEquivalents(15.99, "monthly");
assert.equal(monthly.monthly, 15.99);
assert.equal(monthly.annual, 191.88);

const data = finance([
  transaction({ id: "n1", amount: 15.99, date: "2026-08-05", notes: "Netflix" }),
  transaction({ id: "n2", amount: 15.99, date: "2026-09-05", notes: "NETFLIX.COM" }),
  transaction({ id: "g1", amount: 24, date: "2026-08-03", notes: "Planet Fitness" }),
  transaction({ id: "g2", amount: 24, date: "2026-09-03", notes: "Planet Fitness" }),
  transaction({ id: "p1", amount: 10, date: "2026-07-04", notes: "Spotify" }),
  transaction({ id: "p2", amount: 10, date: "2026-08-04", notes: "Spotify" }),
  transaction({ id: "p3", amount: 12, date: "2026-09-04", notes: "Spotify" }),
]);

const candidates = detectRecurringBillCandidatesFromFinanceData(data, []);
const review = buildRecurringReview(candidates, { transactions: data.transactions });
const netflix = review.find((item) => item.merchantKey === "netflix");
const gym = review.find((item) => item.merchantKey === "planet fitness");
const spotify = review.find((item) => item.merchantKey === "spotify");

assert.ok(netflix);
assert.equal(netflix.kind, "subscription");
assert.equal(netflix.typicalAmount, 15.99);
assert.equal(netflix.frequency, "monthly");
assert.equal(netflix.monthlyEquivalent, 15.99);
assert.equal(netflix.annualEquivalent, 191.88);
assert.equal(netflix.nextCharge, "2026-10-05");
assert.equal(netflix.confidence, "needs_confirmation");
assert.equal(netflix.candidate.action, "create");
assert.equal(gym.kind, "membership");
assert.equal(gym.candidate.category, "Memberships");
assert.equal(spotify.confidence, "likely");
assert.deepEqual(spotify.priceChange, { previousAverage: 10, latestAmount: 12 });

const evidence = recurringEvidenceKey(netflix.candidate);
assert.equal(isRecurringDismissalCurrent(evidence, netflix.candidate), true);
const hidden = buildRecurringReview(candidates, {
  transactions: data.transactions,
  dismissals: { netflix: evidence },
});
assert.equal(hidden.some((item) => item.merchantKey === "netflix"), false);
assert.equal(
  isRecurringDismissalCurrent(evidence, {
    ...netflix.candidate,
    lastPaymentDate: "2026-10-05",
    transactionIds: [...netflix.candidate.transactionIds, "n3"],
  }),
  false,
);

const withBill = finance(data.transactions, [
  {
    id: "bill-netflix",
    name: "Netflix",
    amount: 15.99,
    dueDay: 5,
    autopay: false,
    recurring: true,
    category: "Subscriptions",
    paidMonth: null,
  },
]);
const matched = detectRecurringBillCandidatesFromFinanceData(withBill, []);
const matchedReview = buildRecurringReview(matched, { transactions: withBill.transactions });
assert.equal(matchedReview.some((item) => item.merchantKey === "netflix"), false);

const suggestions = detectRecurringBillSuggestions(data, reference);
const netflixSuggestion = suggestions.find((item) => item.kind === "recurring_bill");
assert.ok(netflixSuggestion);
assert.equal(netflixSuggestion.primaryAction.type, "create_bill");
assert.match(netflixSuggestion.description, /will not add it until you confirm/);
assert.match(netflixSuggestion.description, /per month/);
assert.match(netflixSuggestion.description, /per year/);

assert.equal(
  recurringPriceChange([
    { amount: 40, date: "2026-08-01" },
    { amount: 41, date: "2026-09-01" },
  ]),
  null,
);

console.log("recurring review checks passed");
