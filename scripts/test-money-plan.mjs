#!/usr/bin/env node
/**
 * Money Plan reads the current engines and does not move money.
 *
 * Usage: npm run test:money-plan
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";
import { getSafeToSpend } from "../lib/finance/safeToSpend.ts";
import { isFounderEmail } from "../lib/founder/emails.ts";
import {
  moneyPlanApiResult,
  resolveMoneyPlanAccess,
  sanitizeMoneyPlanBudgets,
} from "../lib/plan/moneyPlanAccess.ts";
import { buildMoneyPlan } from "../lib/plan/moneyPlan.ts";
import { FREE_SUBSCRIPTION, hasProPlusAccess } from "../lib/subscription/types.ts";

const reference = new Date(2026, 9, 12, 12, 0, 0);
const root = path.resolve(import.meta.dirname, "..");

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

const data = finance({
  viewerUserId: "user-a",
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
    ownerUserId: "user-a",
    allocations: [
      {
        id: "rent-alloc",
        name: "Rent",
        icon: "🏠",
        amount: 400,
        isRemainingBalance: false,
        accountId: null,
        goalId: null,
        monthlyTarget: null,
        sortOrder: 0,
      },
      {
        id: "rest",
        name: "Spending",
        icon: "🛍️",
        amount: null,
        isRemainingBalance: true,
        accountId: null,
        goalId: null,
        monthlyTarget: null,
        sortOrder: 1,
      },
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
  ],
  savingsGoals: [
    {
      id: "goal-1",
      name: "Emergency fund",
      type: "emergency_fund",
      icon: "🛟",
      current: 400,
      target: 1000,
      createdAt: "2026-01-01",
    },
  ],
  transactions: [
    {
      id: "g1",
      amount: 80,
      type: "expense",
      category: "FOOD AND DRINK GROCERIES",
      accountId: "acct",
      transferAccountId: null,
      date: "2026-10-03",
      notes: "Market",
    },
    {
      id: "g2",
      amount: -20,
      type: "expense",
      category: "FOOD AND DRINK GROCERIES",
      accountId: "acct",
      transferAccountId: null,
      date: "2026-10-04",
      notes: "Market refund",
    },
    {
      id: "xfer",
      amount: 300,
      type: "transfer",
      category: "Transfers",
      accountId: "acct",
      transferAccountId: null,
      date: "2026-10-04",
      notes: "Transfer to savings",
    },
    {
      id: "other",
      amount: 500,
      type: "expense",
      category: "FOOD AND DRINK GROCERIES",
      accountId: "acct",
      transferAccountId: null,
      date: "2026-10-04",
      notes: "Roommate",
      ownerUserId: "user-b",
    },
  ],
});

const plan = buildMoneyPlan(
  data,
  reference,
  [
    { category: "FOOD AND DRINK GROCERIES", amount: 100 },
    { category: "Groceries", amount: 50 },
    { category: "Transfers", amount: 10 },
  ],
);

assert.equal(plan.safeToSpend, getSafeToSpend(data, reference));
assert.equal(plan.month, "2026-10");
assert.equal(plan.incomePlan.paycheckAmount, 2000);
assert.equal(plan.incomePlan.nextPayDate, "2026-10-16");
assert.equal(plan.incomePlan.allocations[1].amountLabel, "Remainder of the paycheck");
assert.equal(plan.bills.some((bill) => bill.name === "Phone"), false);
assert.equal(plan.bills.some((bill) => bill.name === "Rent"), true);
assert.equal(plan.debtMinimums, 50);
assert.equal(plan.debts[0].name, "Visa");
assert.equal(plan.goals.length, 1);
assert.equal(plan.goals[0].remaining, 600);
assert.equal(Object.hasOwn(plan.goals[0], "estimatedCompletionDate"), false);
assert.equal(plan.budgets.length, 1);
assert.equal(plan.budgets[0].category, "Groceries");
assert.equal(plan.budgets[0].limit, 50);
assert.equal(plan.budgets[0].spent, 60);
assert.equal(plan.budgets[0].over, true);
assert.match(plan.budgets[0].detail, /confirmed Groceries expenses posted in 2026-10/);

const hidden = buildMoneyPlan(
  finance({
    viewerUserId: "user-a",
    incomePlan: {
      ...data.incomePlan,
      ownerUserId: "user-b",
    },
  }),
  reference,
);
assert.equal(hidden.incomePlan, null);

const plans = fs.readFileSync(path.join(root, "lib/subscription/plans.ts"), "utf8");
const screen = fs.readFileSync(path.join(root, "components/plan/MoneyPlanContent.tsx"), "utf8");
const preview = fs.readFileSync(path.join(root, "components/plan/MoneyPlanPreview.tsx"), "utf8");
const client = fs.readFileSync(path.join(root, "components/plan/MoneyPlanScreen.tsx"), "utf8");
const page = fs.readFileSync(path.join(root, "app/(authenticated)/money-plan/page.tsx"), "utf8");
const route = fs.readFileSync(path.join(root, "app/api/money-plan/route.ts"), "utf8");
const gate = fs.readFileSync(path.join(root, "lib/plan/moneyPlanGate.server.ts"), "utf8");
const engine = fs.readFileSync(path.join(root, "lib/plan/moneyPlan.ts"), "utf8");
const reports = fs.readFileSync(path.join(root, "components/reports/ReportsContent.tsx"), "utf8");
const iosReports = fs.readFileSync(path.join(root, "components/native/ios/IosReportsScreen.tsx"), "utf8");
assert.match(plans, /PRO_PLUS_ROUTE_PREFIXES = \[\]/);
assert.match(plans, /\$7\.99/);
assert.match(plans, /\$14\.99/);
assert.doesNotMatch(plans, /\/money-plan/);
assert.match(screen, /does not move money/);
assert.doesNotMatch(screen, /useFinance|buildMoneyPlan|ProUpgradeBanner/);
assert.doesNotMatch(screen, /executePaycheck|markIncomePlan/);
assert.match(preview, /Upgrade to Pro\+/);
assert.match(preview, /\/settings\?upgrade=pro_plus#billing/);
assert.match(preview, /Included with Pro\+/);
assert.doesNotMatch(preview, /useFinance|buildMoneyPlan|formatCurrency|safeToSpend/);
assert.match(client, /\/api\/money-plan/);
assert.doesNotMatch(client, /buildMoneyPlan|useFinance/);
assert.match(page, /readMoneyPlanAccess/);
assert.match(page, /force-dynamic/);
assert.match(route, /export async function GET/);
assert.match(route, /export async function POST/);
assert.match(route, /moneyPlanHttpResponse/);
assert.match(gate, /getEffectiveEntitlements/);
assert.match(gate, /adminFounderGranted/);
assert.match(gate, /resolveMoneyPlanAccess/);
assert.match(gate, /moneyPlanApiResult/);
assert.ok(gate.indexOf('access !== "full"') < gate.indexOf("loadFinanceData"));
assert.doesNotMatch(gate, /STRIPE_PRO_PLUS_PRICE|service_role|serviceRole/);
assert.match(reports, /featureLabel="Advanced reports"/);
assert.match(iosReports, /featureLabel="Advanced reports"/);
assert.doesNotMatch(engine, /remaining \/ 12|GOAL_ALLOCATION/);
assert.doesNotMatch(engine, /executePaycheck|markIncomePlan/);

const future = "2099-01-01T00:00:00.000Z";
const past = "2000-01-01T00:00:00.000Z";

function subscription(partial) {
  return { ...FREE_SUBSCRIPTION, ...partial };
}

function accessFor(partial, isFounder = false) {
  const current = subscription(partial);
  return resolveMoneyPlanAccess({
    isFounder,
    hasProPlusAccess: hasProPlusAccess(current),
  });
}

assert.equal(accessFor({ plan: "free", status: "none" }), "preview");
assert.equal(
  accessFor({ plan: "pro", status: "active", provider: "stripe", currentPeriodEnd: future }),
  "preview",
);
assert.equal(
  accessFor({ plan: "pro_plus", status: "active", provider: "stripe", currentPeriodEnd: future }),
  "full",
);
assert.equal(
  accessFor({ plan: "pro_plus", status: "trialing", provider: "stripe", currentPeriodEnd: future }),
  "full",
);
assert.equal(
  accessFor({ plan: "pro_plus", status: "past_due", provider: "stripe", currentPeriodEnd: future }),
  "full",
);
assert.equal(
  accessFor({ plan: "pro_plus", status: "canceled", provider: "stripe", currentPeriodEnd: future }),
  "preview",
);
assert.equal(
  accessFor({ plan: "pro_plus", status: "active", provider: "stripe", currentPeriodEnd: past }),
  "preview",
);
assert.equal(
  accessFor({
    plan: "pro_plus",
    status: "active",
    provider: "apple",
    currentPeriodEnd: null,
  }),
  "preview",
);
assert.equal(accessFor({ plan: "free", status: "none" }, true), "full");
assert.equal(
  accessFor({ plan: "pro", status: "active", provider: "stripe", currentPeriodEnd: future }, true),
  "full",
);

process.env.FOUNDER_EMAILS = "founder@buxme.co";
assert.equal(isFounderEmail("founder@buxme.co"), true);
assert.equal(isFounderEmail("person@buxme.co"), false);
assert.equal(
  resolveMoneyPlanAccess({
    isFounder: isFounderEmail("founder@buxme.co"),
    hasProPlusAccess: false,
  }),
  "full",
);
assert.equal(
  resolveMoneyPlanAccess({
    isFounder: isFounderEmail("person@buxme.co"),
    hasProPlusAccess: hasProPlusAccess(
      subscription({ plan: "pro", status: "active", provider: "stripe", currentPeriodEnd: future }),
    ),
  }),
  "preview",
);

const blocked = moneyPlanApiResult({ access: "preview", plan });
assert.equal(blocked.status, 403);
assert.equal(blocked.body.access, "preview");
assert.equal(blocked.body.upgradePlan, "pro_plus");
assert.equal(Object.hasOwn(blocked.body, "plan"), false);
assert.doesNotMatch(JSON.stringify(blocked.body), /safeToSpend|2000/);
const opened = moneyPlanApiResult({ access: "full", plan });
assert.equal(opened.status, 200);
assert.equal(opened.body.plan.safeToSpend, plan.safeToSpend);
assert.equal(moneyPlanApiResult({ access: "full", plan: null }).status, 403);
assert.deepEqual(sanitizeMoneyPlanBudgets("nope"), []);
assert.deepEqual(
  sanitizeMoneyPlanBudgets([
    { category: "Groceries", amount: 50 },
    { category: "Rent", amount: -1 },
    { category: "", amount: 10 },
  ]),
  [{ category: "Groceries", amount: 50 }],
);

console.log("Money Plan checks passed.");
