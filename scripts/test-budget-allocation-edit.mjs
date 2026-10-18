#!/usr/bin/env node
/**
 * Budget allocation edit helpers: account labels, stale sync, shared forecasts.
 * Usage: npm run test:budget-allocation-edit
 */
import assert from "node:assert/strict";
import {
  eligibleLinkAccounts,
  formatBankAccountLabel,
  formatBankAccountShort,
  isBalanceStale,
} from "../lib/budgets/accountDisplay.ts";
import { buildAccountForecasts } from "../lib/budgets/accountForecast.ts";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";

console.log("1) Account labels use nickname + institution + last four");
const account = {
  id: "acct-1",
  name: "Checking ****1234",
  nickname: "Everyday",
  institution: "Chase",
  type: "checking",
  balance: 100,
  monthlyChange: 0,
  lastFour: "1234",
  lastSyncedAt: new Date().toISOString(),
  isPlaidLinked: true,
};
assert.match(formatBankAccountLabel(account), /Everyday/);
assert.match(formatBankAccountLabel(account), /Chase/);
assert.match(formatBankAccountLabel(account), /1234/);
assert.match(formatBankAccountShort(account), /Everyday/);
assert.match(formatBankAccountShort(account), /1234/);

console.log("2) Credit cards excluded from link picker");
const eligible = eligibleLinkAccounts([
  account,
  {
    ...account,
    id: "cc",
    type: "credit_card",
    name: "Visa",
  },
  {
    ...account,
    id: "hidden",
    isHidden: true,
  },
]);
assert.equal(eligible.length, 1);
assert.equal(eligible[0].id, "acct-1");

console.log("3) Stale when missing or older than 7 days");
assert.equal(isBalanceStale(null), true);
assert.equal(isBalanceStale(new Date().toISOString()), false);
const old = new Date();
old.setDate(old.getDate() - 10);
assert.equal(isBalanceStale(old.toISOString()), true);

console.log("4) Moving allocation between accounts updates both forecasts");
const savings = {
  id: "sav",
  name: "Savings",
  institution: "Bank",
  type: "savings",
  balance: 200,
  monthlyChange: 0,
  lastSyncedAt: new Date().toISOString(),
};
const checking = {
  id: "chk",
  name: "Checking",
  institution: "Bank",
  type: "checking",
  balance: 50,
  monthlyChange: 0,
  lastSyncedAt: new Date().toISOString(),
};
const basePlan = {
  id: "plan",
  paySchedule: "weekly",
  paycheckAmount: 400,
  anchorDate: "2026-10-03",
  weeklyDayOfWeek: 5,
  monthlyDays: [1, 15],
  customIntervalDays: null,
  depositAccountId: checking.id,
  nextPayDate: "2026-10-24",
  lastProcessedDate: null,
  isActive: true,
  ownerUserId: "owner",
  allocations: [
    {
      id: "rent",
      name: "Rent Reserve",
      icon: "🔑",
      amount: 175,
      percentage: null,
      allocationType: "fixed",
      isRemainingBalance: false,
      accountId: savings.id,
      goalId: null,
      billId: null,
      debtId: null,
      investmentId: null,
      monthlyTarget: null,
      contributionFrequency: null,
      sortOrder: 0,
    },
    {
      id: "spend",
      name: "Personal Spending",
      icon: "🛒",
      amount: 225,
      percentage: null,
      allocationType: "fixed",
      isRemainingBalance: false,
      accountId: checking.id,
      goalId: null,
      billId: null,
      debtId: null,
      investmentId: null,
      monthlyTarget: null,
      contributionFrequency: null,
      sortOrder: 1,
    },
  ],
};
const before = buildAccountForecasts({
  ...emptyFinanceData,
  viewerUserId: "owner",
  accounts: [savings, checking],
  incomePlan: basePlan,
});
assert.ok(before.accounts.find((item) => item.accountId === savings.id));
assert.equal(
  before.accounts.find((item) => item.accountId === savings.id).weeklyPlannedDeposits,
  175,
);

const afterPlan = {
  ...basePlan,
  allocations: basePlan.allocations.map((allocation) =>
    allocation.id === "rent"
      ? { ...allocation, accountId: checking.id }
      : allocation,
  ),
};
const after = buildAccountForecasts({
  ...emptyFinanceData,
  viewerUserId: "owner",
  accounts: [savings, checking],
  incomePlan: afterPlan,
});
assert.equal(
  after.accounts.find((item) => item.accountId === savings.id),
  undefined,
);
const shared = after.accounts.find((item) => item.accountId === checking.id);
assert.ok(shared);
assert.equal(shared.isSharedDestination, true);
assert.equal(shared.weeklyPlannedDeposits, 400);
assert.equal(shared.purposes.length, 2);

console.log("5) Month horizons expose 1/3/6/12 labels");
const houseHorizon = before.accounts[0].horizons;
assert.deepEqual(
  houseHorizon.map((item) => item.id),
  ["1m", "3m", "6m", "12m"],
);

console.log("✅ Budget allocation edit regression checks passed.");
