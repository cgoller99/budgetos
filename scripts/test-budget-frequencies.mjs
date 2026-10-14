#!/usr/bin/env node
/**
 * Flexible category-budget periods and the single monthly equivalent
 * reported beside Safe to Spend.
 *
 * Usage: npm run test:budget-frequencies
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  budgetMonthlyEquivalent,
  currentBudgetPeriod,
  dateInBudgetPeriod,
  scheduleForEdit,
  sumBudgetMonthlyEquivalents,
} from "../lib/budgets/budgetPeriod.ts";
import {
  buildCategoryBudgetViews,
  netCategorySpending,
} from "../lib/budgets/categoryBudgets.ts";
import { createSupabaseCategoryBudgetRemote } from "../lib/budgets/categoryBudgetRemote.ts";
import {
  applyCategoryBudgetEdits,
  emptyCategoryBudgetSnapshot,
  parseCategoryBudgetCache,
  serializeCategoryBudgetCache,
  visibleCategoryBudgets,
} from "../lib/budgets/categoryBudgetSync.ts";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";
import { calculateMoneyFlow } from "../lib/finance/moneyFlow.ts";
import { getSafeToSpend } from "../lib/finance/safeToSpend.ts";
import { findBudgetOverspending } from "../lib/automation/financialInsights.ts";
import { buildMoneyPlan } from "../lib/plan/moneyPlan.ts";
import { sanitizeMoneyPlanBudgets } from "../lib/plan/moneyPlanAccess.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

function on(year, month, day) {
  return new Date(year, month - 1, day, 12, 0, 0);
}

function finance(partial) {
  return {
    ...emptyFinanceData,
    accounts: [
      {
        id: "acct",
        name: "Checking",
        institution: "Bank",
        type: "checking",
        balance: 5000,
        monthlyChange: 0,
      },
    ],
    viewerUserId: "user-a",
    income: [
      {
        id: "job",
        name: "Job",
        amount: 4000,
        frequency: "monthly",
        category: "Payroll",
      },
    ],
    ...partial,
  };
}

function transaction(partial) {
  return {
    id: partial.id,
    amount: partial.amount,
    type: partial.type ?? "expense",
    category: partial.category ?? "Groceries",
    accountId: "acct",
    transferAccountId: null,
    date: partial.date,
    notes: partial.notes ?? "",
    billId: null,
    goalId: partial.goalId ?? null,
    ownerUserId: partial.ownerUserId ?? null,
  };
}

function period(schedule, reference) {
  return currentBudgetPeriod(schedule, reference);
}

const weekly = {
  frequency: "weekly",
  anchorDate: "2026-09-28",
  weekday: 1,
};

const crossing = period(weekly, on(2026, 10, 1));
assert.equal(crossing.start, "2026-09-28");
assert.equal(crossing.end, "2026-10-04");
assert.equal(dateInBudgetPeriod("2026-09-30", crossing), true);
assert.equal(dateInBudgetPeriod("2026-10-01", crossing), true);
assert.equal(dateInBudgetPeriod("2026-10-04", crossing), true);
assert.equal(dateInBudgetPeriod("2026-09-27", crossing), false);
assert.equal(dateInBudgetPeriod("2026-10-05", crossing), false);

const weekLater = period(weekly, on(2026, 10, 15));
assert.equal(weekLater.start, "2026-10-12");
assert.equal(weekLater.end, "2026-10-18");
assert.notEqual(weekLater.start, "2026-10-15");
assert.equal(period(weekly, on(2026, 10, 15)).start, weekLater.start);

const biweekly = { frequency: "biweekly", anchorDate: "2026-10-01" };
const earlyBiweekly = period(biweekly, on(2026, 10, 14));
const nextBiweekly = period(biweekly, on(2026, 10, 15));
const novemberBiweekly = period(biweekly, on(2026, 11, 1));
assert.equal(earlyBiweekly.start, "2026-10-01");
assert.equal(earlyBiweekly.end, "2026-10-14");
assert.equal(nextBiweekly.start, "2026-10-15");
assert.equal(nextBiweekly.end, "2026-10-28");
assert.equal(novemberBiweekly.start, "2026-10-29");
assert.equal(novemberBiweekly.end, "2026-11-11");
assert.equal(dateInBudgetPeriod("2026-10-14", earlyBiweekly), true);
assert.equal(dateInBudgetPeriod("2026-10-14", nextBiweekly), false);
assert.equal(dateInBudgetPeriod("2026-10-15", earlyBiweekly), false);
assert.equal(dateInBudgetPeriod("2026-11-11", novemberBiweekly), true);
assert.equal(dateInBudgetPeriod("2026-11-12", novemberBiweekly), false);
assert.notEqual(novemberBiweekly.start, "2026-11-01");

const beforeAnchor = period(biweekly, on(2026, 9, 20));
assert.equal(beforeAnchor.start, "2026-10-01");
assert.equal(beforeAnchor.end, "2026-10-14");

const halves = { frequency: "twice_monthly", monthDays: [15, 1] };
assert.deepEqual(period(halves, on(2026, 10, 14)), {
  start: "2026-10-01",
  end: "2026-10-14",
});
assert.deepEqual(period(halves, on(2026, 10, 15)), {
  start: "2026-10-15",
  end: "2026-10-31",
});
assert.deepEqual(period(halves, on(2026, 11, 1)), {
  start: "2026-11-01",
  end: "2026-11-14",
});
assert.equal(dateInBudgetPeriod("2026-10-14", period(halves, on(2026, 10, 14))), true);
assert.equal(dateInBudgetPeriod("2026-10-14", period(halves, on(2026, 10, 15))), false);
assert.deepEqual(period({ frequency: "twice_monthly", monthDays: [20, 5] }, on(2026, 10, 3)), {
  start: "2026-09-20",
  end: "2026-10-04",
});
assert.deepEqual(period({ frequency: "twice_monthly", monthDays: [1, 15] }, on(2026, 2, 15)), {
  start: "2026-02-15",
  end: "2026-02-28",
});
assert.deepEqual(period({ frequency: "twice_monthly", monthDays: [30, 31] }, on(2026, 2, 10)), {
  start: "2026-02-01",
  end: "2026-02-28",
});

const custom = { frequency: "custom", anchorDate: "2026-10-01", intervalDays: 10 };
const customNow = period(custom, on(2026, 10, 15));
assert.deepEqual(customNow, { start: "2026-10-11", end: "2026-10-20" });
assert.equal(dateInBudgetPeriod("2026-10-10", period(custom, on(2026, 10, 10))), true);
assert.equal(dateInBudgetPeriod("2026-10-10", customNow), false);
assert.equal(dateInBudgetPeriod("2026-10-11", period(custom, on(2026, 10, 10))), false);
assert.equal(dateInBudgetPeriod("2026-10-11", customNow), true);

const monthly = period({}, on(2026, 10, 15));
const explicitMonthly = period({ frequency: "monthly", anchorDate: "2026-10-20" }, on(2026, 10, 15));
assert.deepEqual(monthly, { start: "2026-10-01", end: "2026-10-31" });
assert.deepEqual(explicitMonthly, monthly);
assert.equal(dateInBudgetPeriod("2026-09-30", monthly), false);
assert.equal(dateInBudgetPeriod("2026-10-01", monthly), true);
assert.equal(dateInBudgetPeriod("2026-11-01", monthly), false);

const edited = scheduleForEdit({}, { frequency: "weekly", weekday: 1 }, on(2026, 10, 15));
assert.equal(edited.anchorDate, "2026-10-12");
assert.equal(edited.weekday, 1);
assert.equal(scheduleForEdit(edited, {}, on(2026, 11, 3)).anchorDate, "2026-10-12");

assert.equal(budgetMonthlyEquivalent(150, { frequency: "weekly" }), 650);
assert.equal(budgetMonthlyEquivalent(100, { frequency: "biweekly" }), 216.67);
assert.equal(budgetMonthlyEquivalent(80, { frequency: "twice_monthly" }), 160);
assert.equal(budgetMonthlyEquivalent(200, {}), 200);
assert.equal(budgetMonthlyEquivalent(200, { frequency: "monthly" }), 200);
assert.equal(
  budgetMonthlyEquivalent(50, { frequency: "custom", intervalDays: 30 }),
  50.69,
);
assert.equal(budgetMonthlyEquivalent(0, { frequency: "weekly" }), 0);
assert.equal(
  sumBudgetMonthlyEquivalents([
    { category: "Groceries", amount: 150, frequency: "weekly" },
    { category: "Groceries", amount: 40, frequency: "monthly" },
    { category: "Gas", amount: 80, frequency: "weekly" },
  ]),
  Math.round((40 + (80 * 52) / 12) * 100) / 100,
);

const activity = finance({
  transactions: [
    transaction({ id: "prev", amount: 25, date: "2026-10-01", category: "Groceries" }),
    transaction({ id: "now", amount: 40, date: "2026-10-15", category: "Groceries" }),
    transaction({ id: "dine-old", amount: 70, date: "2026-10-02", category: "Restaurants" }),
    transaction({ id: "dine", amount: 30, date: "2026-10-16", category: "Restaurants" }),
    transaction({ id: "gas", amount: 20, date: "2026-10-13", category: "Gas" }),
    transaction({ id: "shop", amount: 90, date: "2026-10-09", category: "Shopping" }),
    transaction({ id: "shop-old", amount: 15, date: "2026-09-30", category: "Shopping" }),
    transaction({
      id: "other",
      amount: 80,
      date: "2026-10-15",
      category: "Groceries",
      ownerUserId: "user-b",
    }),
    transaction({
      id: "goal",
      amount: 50,
      date: "2026-10-15",
      category: "Groceries",
      goalId: "goal-1",
    }),
    transaction({
      id: "refund",
      amount: 5,
      type: "income",
      date: "2026-10-15",
      category: "Groceries",
      notes: "Store refund",
    }),
  ],
});

const reference = on(2026, 10, 15);
const limits = [
  { category: "Groceries", amount: 150, frequency: "weekly", anchorDate: "2026-09-28", weekday: 1 },
  { category: "Restaurants", amount: 100, frequency: "biweekly", anchorDate: "2026-10-01" },
  { category: "Gas", amount: 80, frequency: "weekly", anchorDate: "2026-10-12", weekday: 1 },
  { category: "Shopping", amount: 200 },
];
const views = buildCategoryBudgetViews(limits, activity, reference);
const view = (category) => views.find((item) => item.category === category);

assert.equal(view("Groceries").periodStart, "2026-10-12");
assert.equal(view("Groceries").periodEnd, "2026-10-18");
assert.equal(view("Groceries").spent, 35);
assert.equal(view("Groceries").remaining, 115);
assert.equal(view("Groceries").monthlyEquivalent, 650);
assert.equal(view("Restaurants").periodStart, "2026-10-15");
assert.equal(view("Restaurants").spent, 30);
assert.equal(view("Gas").spent, 20);
assert.equal(view("Shopping").frequency, "monthly");
assert.equal(view("Shopping").periodStart, "2026-10-01");
assert.equal(view("Shopping").periodEnd, "2026-10-31");
assert.equal(view("Shopping").spent, 90);
assert.equal(view("Shopping").monthlyEquivalent, 200);
assert.equal(netCategorySpending(activity, "2026-10").get("Shopping"), 90);
assert.equal(netCategorySpending(activity, "2026-10").has("Groceries"), true);

const boundaryData = finance({
  transactions: [
    transaction({ id: "edge", amount: 10, date: "2026-10-04" }),
    transaction({ id: "next", amount: 7, date: "2026-10-05" }),
  ],
});
const firstWeek = buildCategoryBudgetViews(
  [{ category: "Groceries", amount: 50, ...weekly }],
  boundaryData,
  on(2026, 10, 1),
);
const secondWeek = buildCategoryBudgetViews(
  [{ category: "Groceries", amount: 50, ...weekly }],
  boundaryData,
  on(2026, 10, 5),
);
assert.equal(firstWeek[0].spent, 10);
assert.equal(secondWeek[0].spent, 7);
assert.equal(firstWeek[0].spent + secondWeek[0].spent, 17);

const quiet = finance({ transactions: [] });
const quietSpend = getSafeToSpend(quiet, reference);
const activeSpend = getSafeToSpend(activity, reference);
const plan = buildMoneyPlan(activity, reference, limits);
const monthlyTotal =
  Math.round(
    (650 + 216.67 + Math.round(((80 * 52) / 12) * 100) / 100 + 200) * 100,
  ) / 100;
assert.equal(plan.safeToSpend, activeSpend);
assert.equal(plan.safeToSpend, calculateMoneyFlow(activity, reference).safeToSpend);
assert.equal(plan.monthlyBudgetTotal, monthlyTotal);
assert.ok(quietSpend - activeSpend > 35);
assert.notEqual(
  plan.safeToSpend,
  Math.round((activeSpend - plan.monthlyBudgetTotal) * 100) / 100,
);
assert.notEqual(
  plan.safeToSpend,
  Math.round((activeSpend - (150 + 100 + 80 + 200)) * 100) / 100,
);
assert.equal(plan.budgets.find((item) => item.category === "Groceries").spent, 40);
assert.match(plan.budgets.find((item) => item.category === "Shopping").detail, /posted in 2026-10/);
assert.match(
  plan.budgets.find((item) => item.category === "Groceries").detail,
  /posted from 2026-10-12 to 2026-10-18/,
);

const over = findBudgetOverspending(
  activity,
  [{ category: "Groceries", amount: 20, frequency: "weekly", anchorDate: "2026-09-28", weekday: 1 }],
  reference,
);
assert.equal(over.length, 1);
assert.match(over[0].detail, /from 2026-10-12 to 2026-10-18/);
assert.match(over[0].detail, /\$40\.00/);
const monthOver = findBudgetOverspending(
  activity,
  [{ category: "Groceries", amount: 10 }],
  reference,
);
assert.match(monthOver[0].detail, /posted in 2026-10/);

const saved = applyCategoryBudgetEdits(
  emptyCategoryBudgetSnapshot(),
  [
    {
      category: "Groceries",
      amount: 150,
      frequency: "weekly",
      anchorDate: "2026-09-28",
      weekday: 1,
    },
    { category: "Gas", amount: 40 },
  ],
  "2026-10-15T00:00:00.000Z",
);
assert.equal(visibleCategoryBudgets(saved).find((item) => item.category === "Groceries").anchorDate, "2026-09-28");
assert.deepEqual(
  visibleCategoryBudgets(saved).find((item) => item.category === "Gas"),
  { category: "Gas", amount: 40 },
);
const roundTrip = visibleCategoryBudgets(parseCategoryBudgetCache(serializeCategoryBudgetCache(saved)));
assert.equal(roundTrip.find((item) => item.category === "Groceries").frequency, "weekly");
assert.equal(roundTrip.find((item) => item.category === "Groceries").anchorDate, "2026-09-28");

const kept = applyCategoryBudgetEdits(
  saved,
  [
    {
      category: "Groceries",
      amount: 160,
      frequency: "weekly",
      anchorDate: "2026-09-28",
      weekday: 1,
    },
    { category: "Gas", amount: 40 },
  ],
  "2026-10-16T00:00:00.000Z",
);
assert.equal(visibleCategoryBudgets(kept).find((item) => item.category === "Groceries").amount, 160);
assert.equal(visibleCategoryBudgets(kept).find((item) => item.category === "Groceries").anchorDate, "2026-09-28");

assert.deepEqual(
  sanitizeMoneyPlanBudgets([
    { category: "Groceries", amount: 50 },
    {
      category: "Dining",
      amount: 100,
      frequency: "biweekly",
      anchorDate: "2026-10-01",
    },
  ]),
  [
    { category: "Groceries", amount: 50 },
    {
      category: "Dining",
      amount: 100,
      frequency: "biweekly",
      anchorDate: "2026-10-01",
      weekday: null,
      monthDays: null,
      intervalDays: null,
    },
  ],
);

const rows = [
  {
    user_id: "user-a",
    category: "Groceries",
    amount: 80,
    updated_at: "2026-10-01T00:00:00.000Z",
  },
];
let scheduleColumns = false;
function stubClient(actor) {
  return {
    from(table) {
      if (table !== "category_budgets") throw new Error(`Unexpected table ${table}`);
      const filters = [];
      let mode = "select";
      let selected = "";
      const query = {
        select(columns) {
          mode = "select";
          selected = columns;
          return query;
        },
        eq(column, value) {
          filters.push([column, value]);
          return query;
        },
        delete() {
          mode = "delete";
          return query;
        },
        upsert(body) {
          if (body.user_id !== actor) {
            return Promise.resolve({ error: { message: "new row violates row-level security" } });
          }
          if ("frequency" in body && !scheduleColumns) {
            return Promise.resolve({
              error: { code: "42703", message: "column category_budgets.frequency does not exist" },
            });
          }
          const index = rows.findIndex(
            (row) => row.user_id === body.user_id && row.category === body.category,
          );
          if (index === -1) rows.push({ ...body });
          else rows[index] = { ...rows[index], ...body };
          return Promise.resolve({ error: null });
        },
        then(onFulfilled, onRejected) {
          try {
            if (mode === "select" && selected.includes("frequency") && !scheduleColumns) {
              onFulfilled({
                data: null,
                error: { code: "42703", message: "column category_budgets.frequency does not exist" },
              });
              return;
            }
            const data = rows.filter(
              (row) =>
                row.user_id === actor &&
                filters.every(([column, value]) => row[column] === value),
            );
            onFulfilled({ data, error: null });
          } catch (error) {
            onRejected?.(error);
          }
        },
      };
      return query;
    },
  };
}

const legacyRemote = createSupabaseCategoryBudgetRemote(stubClient("user-a"), "user-a");
assert.deepEqual(await legacyRemote.list(), [
  { category: "Groceries", amount: 80, updatedAt: "2026-10-01T00:00:00.000Z" },
]);
await legacyRemote.save({
  category: "Groceries",
  amount: 150,
  updatedAt: "2026-10-15T00:00:00.000Z",
  frequency: "weekly",
  anchorDate: "2026-09-28",
  weekday: 1,
});
assert.equal(rows.find((row) => row.category === "Groceries").amount, 150);
assert.equal(rows.find((row) => row.category === "Groceries").frequency, undefined);

scheduleColumns = true;
await legacyRemote.save({
  category: "Dining",
  amount: 100,
  updatedAt: "2026-10-15T00:00:00.000Z",
  frequency: "biweekly",
  anchorDate: "2026-10-01",
  weekday: null,
  monthDays: null,
  intervalDays: null,
});
const listed = await legacyRemote.list();
assert.equal(listed.find((item) => item.category === "Dining").frequency, "biweekly");
assert.equal(listed.find((item) => item.category === "Dining").anchorDate, "2026-10-01");
assert.equal(listed.find((item) => item.category === "Groceries").frequency, undefined);

const migration = read("supabase/migrations/20261014_category_budget_frequency.sql");
assert.match(migration, /add column if not exists frequency/i);
assert.match(migration, /default 'monthly'/);
assert.doesNotMatch(migration, /update\s+public\.category_budgets/i);
assert.doesNotMatch(migration, /delete from/i);

for (const relativePath of [
  "lib/budgets/budgetPeriod.ts",
  "lib/budgets/categoryBudgets.ts",
  "lib/budgets/categoryBudgetSync.ts",
  "lib/budgets/categoryBudgetRemote.ts",
  "components/budgets/useCategoryBudgets.ts",
]) {
  const source = read(relativePath);
  assert.doesNotMatch(source, /applyBillPayment|updateGoal|applyIncomePlanPaycheck|console\.(log|info|debug)/);
}

assert.doesNotMatch(read("lib/finance/moneyFlow.ts"), /budgetMonthlyEquivalent|category_budgets/);
assert.doesNotMatch(read("lib/finance/safeToSpend.ts"), /budgetMonthlyEquivalent|category_budgets/);
assert.match(read("components/budgets/CategoryBudgetsCard.tsx"), /BudgetScheduleFields/);
assert.match(read("components/native/ios/IosBudgetsSection.tsx"), /BudgetScheduleFields/);
const periodSource = read("lib/budgets/budgetPeriod.ts");
assert.match(periodSource, /Every two weeks/);
assert.match(periodSource, /Twice a month/);
assert.match(periodSource, /Custom period/);
assert.match(read("components/budgets/BudgetScheduleFields.tsx"), /BUDGET_FREQUENCY_LABELS/);
assert.match(read("components/budgets/BudgetScheduleFields.tsx"), /type="date"/);
assert.match(read("components/budgets/BudgetScheduleFields.tsx"), /Starting weekday/);
assert.match(read("components/budgets/BudgetScheduleFields.tsx"), /First day of the month/);
assert.match(read("components/budgets/BudgetScheduleFields.tsx"), /Second day of the month/);
assert.match(read("components/native/ios/IosBudgetsSection.tsx"), /This month/);
assert.match(read(".github/workflows/ci.yml"), /test:budget-frequencies/);

console.log("Budget frequency, period, and Safe to Spend checks passed.");
