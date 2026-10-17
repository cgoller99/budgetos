#!/usr/bin/env node
/**
 * Goal ↔ account linking: allocation caps, stale balances, no double-count.
 *
 * Usage: npm run test:goal-account-link
 */
import assert from "node:assert/strict";
import {
  assignedAmountOnAccount,
  eligibleAccountBalance,
  isAccountLinkStale,
  resolveGoalProgressAmounts,
  summarizeAccountGoalShares,
  validateGoalAccountLink,
} from "../lib/finance/goalAccountLink.ts";
import { enrichGoal } from "../lib/finance/goals.ts";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";

function account(partial) {
  return {
    id: "acct-1",
    name: "Investments",
    institution: "Broker",
    type: "investment",
    balance: 5000,
    monthlyChange: 0,
    availableBalance: null,
    isPlaidLinked: true,
    bankConnectionId: "conn-1",
    lastSyncedAt: new Date().toISOString(),
    ...partial,
  };
}

function goal(partial) {
  return {
    id: "goal-1",
    name: "Investments",
    type: "investments",
    icon: "📈",
    current: 200,
    target: 10000,
    createdAt: "2026-01-01",
    ...partial,
  };
}

const base = {
  ...emptyFinanceData,
  accounts: [account()],
  savingsGoals: [goal()],
};

// Eligible balance: investment uses balance; checking prefers available
assert.equal(eligibleAccountBalance(account()), 5000);
assert.equal(
  eligibleAccountBalance(
    account({ type: "checking", balance: 1000, availableBalance: 800 }),
  ),
  800,
);

// Full link tracks account balance; confirmed contributions stay separate
const linkedFull = {
  ...base,
  savingsGoals: [
    goal({
      accountLink: { accountId: "acct-1", mode: "full", allocatedAmount: null },
      linkedSnapshotBalance: 5000,
      linkedSnapshotAt: new Date().toISOString(),
    }),
  ],
};
const amounts = resolveGoalProgressAmounts(
  linkedFull,
  linkedFull.savingsGoals[0],
);
assert.equal(amounts.confirmedContributions, 200);
assert.equal(amounts.accountBalance, 5000);
assert.equal(amounts.assignedToGoal, 5000);
assert.equal(amounts.trackedAmount, 5000);
assert.equal(amounts.linkStale, false);
assert.ok(amounts.marketChangeEstimate === 4800);

// Partial allocation capped by balance
const linkedPartial = {
  ...base,
  savingsGoals: [
    goal({
      id: "goal-a",
      accountLink: {
        accountId: "acct-1",
        mode: "partial",
        allocatedAmount: 1500,
      },
    }),
    goal({
      id: "goal-b",
      name: "House",
      current: 0,
      target: 20000,
      accountLink: {
        accountId: "acct-1",
        mode: "partial",
        allocatedAmount: 4000,
      },
    }),
  ],
};
// goal-a already holds $1,500 → only $3,500 remains of the $5,000 balance
assert.equal(
  validateGoalAccountLink(linkedPartial, "goal-b", {
    accountId: "acct-1",
    mode: "partial",
    allocatedAmount: 3500,
  }).ok,
  true,
);
assert.equal(
  validateGoalAccountLink(linkedPartial, "goal-b", {
    accountId: "acct-1",
    mode: "partial",
    allocatedAmount: 3501,
  }).ok,
  false,
);

// Full mode claims remaining unallocated — allowed alongside partials
const onePartial = {
  ...base,
  savingsGoals: [
    goal({
      id: "goal-a",
      accountLink: {
        accountId: "acct-1",
        mode: "partial",
        allocatedAmount: 2000,
      },
    }),
  ],
};
assert.equal(
  validateGoalAccountLink(onePartial, "goal-full", {
    accountId: "acct-1",
    mode: "full",
    allocatedAmount: null,
  }).ok,
  true,
);

const withFull = {
  ...onePartial,
  savingsGoals: [
    ...onePartial.savingsGoals,
    goal({
      id: "goal-full",
      accountLink: { accountId: "acct-1", mode: "full", allocatedAmount: null },
    }),
  ],
};
assert.equal(
  validateGoalAccountLink(withFull, "goal-new", {
    accountId: "acct-1",
    mode: "partial",
    allocatedAmount: 10,
  }).ok,
  false,
);

const assigned = assignedAmountOnAccount(linkedPartial, "acct-1");
assert.equal(assigned.totalAssigned, 5500);
assert.equal(assigned.hasFullClaim, false);

const share = summarizeAccountGoalShares(withFull, "acct-1");
assert.equal(share.totalBalance, 5000);
assert.equal(share.allocated, 5000);
assert.equal(share.unallocated, 0);
assert.equal(share.shares.length, 2);
assert.equal(
  share.shares.find((item) => item.goalId === "goal-full")?.amount,
  3000,
);

// Shared partials never overlap
const sharePartials = summarizeAccountGoalShares(
  {
    ...base,
    savingsGoals: [
      goal({
        id: "inv",
        name: "Investments",
        accountLink: {
          accountId: "acct-1",
          mode: "partial",
          allocatedAmount: 3000,
        },
      }),
      goal({
        id: "house",
        name: "House",
        accountLink: {
          accountId: "acct-1",
          mode: "partial",
          allocatedAmount: 1500,
        },
      }),
    ],
  },
  "acct-1",
);
assert.equal(sharePartials.allocated, 4500);
assert.equal(sharePartials.unallocated, 500);

// Stale disconnected Plaid uses snapshot
const staleData = {
  ...base,
  accounts: [
    account({
      bankConnectionId: null,
      lastSyncedAt: "2020-01-01T00:00:00.000Z",
    }),
  ],
  savingsGoals: [
    goal({
      accountLink: { accountId: "acct-1", mode: "full", allocatedAmount: null },
      linkedSnapshotBalance: 4200,
      linkedSnapshotAt: "2020-01-02T00:00:00.000Z",
    }),
  ],
};
assert.equal(
  isAccountLinkStale(staleData.accounts[0], staleData.savingsGoals[0].linkedSnapshotAt),
  true,
);
const staleAmounts = resolveGoalProgressAmounts(
  staleData,
  staleData.savingsGoals[0],
);
assert.equal(staleAmounts.linkStale, true);
assert.equal(staleAmounts.accountBalance, 4200);
assert.equal(staleAmounts.trackedAmount, 4200);

// enrichGoal uses tracked amount and does not invent completion without schedule
const enriched = enrichGoal(linkedFull, linkedFull.savingsGoals[0]);
assert.equal(enriched.current, 5000);
assert.equal(enriched.progressAmounts.confirmedContributions, 200);
assert.equal(enriched.weeklyContribution, 0);
assert.equal(enriched.estimatedCompletionDate, null);
assert.equal(enriched.forecast.pace, "insufficient");

console.log("test-goal-account-link: ok");
