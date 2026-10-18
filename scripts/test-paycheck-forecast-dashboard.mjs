#!/usr/bin/env node
/**
 * Paycheck breakdown + account forecast regression.
 * Mirrors the $885.27 weekly savings-rebuild plan without touching live data.
 *
 * Usage: npm run test:paycheck-forecast-dashboard
 */
import assert from "node:assert/strict";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";
import { buildPaycheckBreakdown } from "../lib/budgets/paycheckBreakdown.ts";
import {
  buildAccountForecasts,
  compareWhatIfForecasts,
  summarizeWhatIfPaycheck,
} from "../lib/budgets/accountForecast.ts";

const OWNER = "owner-user-1";
const OTHER = "other-user-2";
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
  id: "acct-savings",
  name: "House Savings",
  institution: "Bank",
  type: "savings",
  balance: 1200,
  monthlyChange: 0,
  lastSyncedAt: "2026-10-14T18:00:00.000Z",
};
const vacationAcct = {
  id: "acct-vacation",
  name: "Vacation",
  institution: "Bank",
  type: "savings",
  balance: 340,
  monthlyChange: 0,
  lastSyncedAt: "2026-10-14T18:00:00.000Z",
};
const investingChecking = {
  id: "acct-investing-checking",
  name: "Investing checking",
  institution: "Bank",
  type: "checking",
  balance: 500,
  monthlyChange: 0,
  lastSyncedAt: "2026-10-14T18:00:00.000Z",
};
const billsAcct = {
  id: "acct-bills",
  name: "Bills",
  institution: "Bank",
  type: "checking",
  balance: 220,
  monthlyChange: 0,
  lastSyncedAt: null,
};
const spendingAcct = {
  id: "acct-spending",
  name: "Spending",
  institution: "Bank",
  type: "checking",
  balance: 410,
  monthlyChange: 0,
  lastSyncedAt: "2026-10-15T12:00:00.000Z",
};
const investmentAcct = {
  id: "acct-invest",
  name: "Brokerage",
  institution: "Broker",
  type: "investment",
  balance: 2500,
  monthlyChange: 0,
  lastSyncedAt: "2026-10-10T09:00:00.000Z",
};

const houseGoal = {
  id: "goal-house",
  name: "Emergency / House Savings",
  type: "emergency",
  icon: "🏠",
  current: 1200,
  target: 20000,
  createdAt: "2026-01-01",
};
const vacationGoal = {
  id: "goal-vacation",
  name: "Vacation",
  type: "vacation",
  icon: "✈️",
  current: 200,
  target: 2000,
  createdAt: "2026-01-01",
};

const plan = {
  id: "plan-885",
  paySchedule: "weekly",
  paycheckAmount: 885.27,
  anchorDate: "2026-10-03",
  weeklyDayOfWeek: 5,
  monthlyDays: [1, 15],
  customIntervalDays: null,
  depositAccountId: spendingAcct.id,
  linkedIncomeSourceId: null,
  nextPayDate: "2026-10-17",
  lastProcessedDate: null,
  isActive: true,
  ownerUserId: OWNER,
  allocations: [
    allocation({
      id: "a-house",
      name: "Emergency / House Savings",
      icon: "🏠",
      amount: 350.27,
      accountId: savings.id,
      goalId: houseGoal.id,
      sortOrder: 0,
    }),
    allocation({
      id: "a-vacation",
      name: "Vacation",
      icon: "✈️",
      amount: 50,
      accountId: vacationAcct.id,
      goalId: vacationGoal.id,
      sortOrder: 1,
    }),
    allocation({
      id: "a-invest",
      name: "Investments",
      icon: "📈",
      amount: 0,
      accountId: investmentAcct.id,
      sortOrder: 2,
    }),
    allocation({
      id: "a-rent",
      name: "Rent Reserve",
      icon: "🔑",
      amount: 175,
      accountId: investingChecking.id,
      sortOrder: 3,
    }),
    allocation({
      id: "a-bills",
      name: "Bills",
      icon: "🧾",
      amount: 110,
      accountId: billsAcct.id,
      billId: "bill-utilities",
      sortOrder: 4,
    }),
    allocation({
      id: "a-spend",
      name: "Personal Spending",
      icon: "🛒",
      amount: 200,
      accountId: spendingAcct.id,
      sortOrder: 5,
    }),
  ],
};

const data = {
  ...emptyFinanceData,
  viewerUserId: OWNER,
  accounts: [
    savings,
    vacationAcct,
    investingChecking,
    billsAcct,
    spendingAcct,
    investmentAcct,
  ],
  savingsGoals: [houseGoal, vacationGoal],
  bills: [
    {
      id: "bill-utilities",
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
  ],
  incomePlan: plan,
  incomePlanPaychecks: [],
};

console.log("1) Paycheck breakdown matches $885.27 plan");
const breakdown = buildPaycheckBreakdown(data, reference);
assert.equal(breakdown.hasPlan, true);
assert.equal(breakdown.paycheckAmount, 885.27);
assert.equal(breakdown.rows.length, 6);
assert.equal(breakdown.unallocated, 0);
assert.equal(breakdown.totalAllocated, 885.27);

const byName = Object.fromEntries(breakdown.rows.map((row) => [row.name, row]));
assert.equal(byName["Emergency / House Savings"].amountPerPaycheck, 350.27);
assert.equal(byName["Emergency / House Savings"].percentOfPaycheck, 39.57);
assert.equal(byName["Emergency / House Savings"].accountId, savings.id);
assert.equal(byName.Vacation.amountPerPaycheck, 50);
assert.equal(byName.Investments.amountPerPaycheck, 0);
assert.equal(byName["Rent Reserve"].accountId, investingChecking.id);
assert.equal(byName.Bills.amountPerPaycheck, 110);
assert.equal(byName["Personal Spending"].amountPerPaycheck, 200);

console.log("2) Empty / inactive plan does not invent rows");
const empty = buildPaycheckBreakdown({ ...data, incomePlan: null }, reference);
assert.equal(empty.hasPlan, false);
assert.equal(empty.rows.length, 0);

console.log("3) Contribution totals match customer acceptance (13w / 26w)");
const forecasts = buildAccountForecasts(data, { horizonWeeks: 13 });
const contribByName = Object.fromEntries(
  forecasts.contributionRows.map((row) => [row.name, row]),
);
assert.equal(contribByName["Emergency / House Savings"].contributionsByHorizon[13], 4553.51);
assert.equal(contribByName["Emergency / House Savings"].contributionsByHorizon[26], 9107.02);
assert.equal(contribByName.Vacation.contributionsByHorizon[13], 650);
assert.equal(contribByName.Vacation.contributionsByHorizon[26], 1300);
assert.equal(contribByName["Rent Reserve"].contributionsByHorizon[13], 2275);
assert.equal(contribByName["Rent Reserve"].contributionsByHorizon[26], 4550);

console.log("4) House savings accumulates from posted balance");
const houseForecast = forecasts.accounts.find((item) => item.accountId === savings.id);
assert.ok(houseForecast);
assert.equal(houseForecast.currentBalance, 1200);
assert.equal(houseForecast.weeklyPlannedDeposits, 350.27);
assert.equal(
  houseForecast.horizons.find((item) => item.weeks === 13).projectedBalance,
  1200 + 350.27 * 13,
);
assert.match(houseForecast.balanceSource, /Ledger|Available|Manual/);

console.log("5) Deposit/spending account: paycheck in, transfers + spending out (net ~0)");
const spendForecast = forecasts.accounts.find((item) => item.accountId === spendingAcct.id);
assert.ok(spendForecast);
assert.equal(spendForecast.weeklyPlannedDeposits, 885.27);
assert.ok(spendForecast.weeklyPlannedWithdrawals >= 885.27 - 0.05);
assert.ok(Math.abs(spendForecast.weeklyNet) < 0.05);
assert.ok(
  Math.abs(
    spendForecast.horizons.find((item) => item.weeks === 13).projectedBalance - 410,
  ) < 1,
);

console.log("6) Rent reserve does not invent endless accumulation without rent bill");
const rentForecast = forecasts.accounts.find(
  (item) => item.accountId === investingChecking.id,
);
assert.ok(rentForecast);
assert.equal(rentForecast.weeklyPlannedDeposits, 175);
assert.equal(rentForecast.weeklyPlannedWithdrawals, 175);
assert.equal(rentForecast.weeklyNet, 0);
assert.equal(
  contribByName["Rent Reserve"].contributionsByHorizon[13],
  2275,
);

console.log("7) Shared destination: combined deposits + purpose contribution totals");
const sharedPlan = {
  ...plan,
  allocations: [
    ...plan.allocations.filter((item) => item.id !== "a-invest" && item.id !== "a-rent"),
    allocation({
      id: "a-rent",
      name: "Rent Reserve",
      icon: "🔑",
      amount: 175,
      accountId: investingChecking.id,
      sortOrder: 3,
    }),
    allocation({
      id: "a-invest",
      name: "Investments",
      icon: "📈",
      amount: 25,
      accountId: investingChecking.id,
      goalId: "goal-invest",
      sortOrder: 2,
    }),
  ],
};
const shared = buildAccountForecasts({
  ...data,
  incomePlan: sharedPlan,
  savingsGoals: [
    ...data.savingsGoals,
    {
      id: "goal-invest",
      name: "Investments",
      type: "investment",
      icon: "📈",
      current: 0,
      target: 10000,
      createdAt: "2026-01-01",
    },
  ],
});
const investing = shared.accounts.find(
  (item) => item.accountId === investingChecking.id,
);
assert.ok(investing);
assert.equal(investing.isSharedDestination, true);
assert.equal(investing.weeklyPlannedDeposits, 200); // 175 rent + 25 invest
assert.equal(investing.purposes.length, 2);
const purposeContrib = investing.purposes.reduce(
  (sum, item) => sum + item.contributionsByHorizon[13],
  0,
);
assert.equal(purposeContrib, 2600);

console.log("8) Investment projections exclude market performance");
const investForecast = forecasts.accounts.find(
  (item) => item.accountId === investmentAcct.id,
);
assert.ok(investForecast);
assert.equal(investForecast.excludesMarketPerformance, true);
assert.equal(investForecast.weeklyPlannedDeposits, 0);
assert.equal(
  investForecast.horizons.find((item) => item.weeks === 52).projectedBalance,
  2500,
);

console.log("9) What-If does not mutate balances");
const whatIf = compareWhatIfForecasts(
  data,
  [{ allocationId: "a-house", amountPerPaycheck: 400 }],
  13,
);
const currentHouse = whatIf.current.accounts.find((item) => item.accountId === savings.id);
const proposedHouse = whatIf.proposed.accounts.find((item) => item.accountId === savings.id);
assert.equal(currentHouse.currentBalance, proposedHouse.currentBalance);
assert.equal(currentHouse.weeklyPlannedDeposits, 350.27);
assert.equal(proposedHouse.weeklyPlannedDeposits, 400);
assert.ok(
  proposedHouse.horizons.find((item) => item.weeks === 13).projectedBalance >
    currentHouse.horizons.find((item) => item.weeks === 13).projectedBalance,
);
const summary = summarizeWhatIfPaycheck(data, [
  { allocationId: "a-house", amountPerPaycheck: 400 },
]);
assert.equal(summary.paycheckAmount, 885.27);

console.log("10) Owner-scoped plan isolation");
const otherViewer = buildPaycheckBreakdown(
  { ...data, viewerUserId: OTHER },
  reference,
);
assert.equal(otherViewer.hasPlan, false);

console.log("11) Bills fund: deposits offset known bill withdrawals");
const billsForecast = forecasts.accounts.find((item) => item.accountId === billsAcct.id);
assert.ok(billsForecast);
assert.equal(billsForecast.weeklyPlannedDeposits, 110);
assert.ok(billsForecast.weeklyPlannedWithdrawals > 0);
assert.ok(billsForecast.upcomingWithdrawals.length > 0);
const bills3m = billsForecast.horizons.find((item) => item.id === "3m");
assert.ok(bills3m);
assert.equal(
  bills3m.projectedBalance,
  Math.round(
    (billsForecast.currentBalance +
      (billsForecast.weeklyPlannedDeposits - billsForecast.weeklyPlannedWithdrawals) *
        13) *
      100,
  ) / 100,
);

console.log("✅ Paycheck forecast dashboard regression checks passed.");
