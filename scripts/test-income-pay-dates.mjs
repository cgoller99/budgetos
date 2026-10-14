#!/usr/bin/env node
/**
 * A stored payday in the past is projected forward for display and for a
 * confirmed apply. The stored plan object itself is not rewritten.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { executePaycheckAllocations } from "../lib/allocation/paycheckEngine.ts";
import { buildCalendarMonth } from "../lib/finance/calendarEvents.ts";
import { forecastCashOutlook } from "../lib/finance/cashOutlook.ts";
import { emptyFinanceData } from "../lib/finance/emptyFinanceData.ts";
import { forecastCashUntilPayday } from "../lib/finance/cashFlowForecast.ts";
import { getIncomeTableRows, getNextPaycheck } from "../lib/finance/income.ts";
import { buildMoneyPlan } from "../lib/plan/moneyPlan.ts";
import { resolveUpcomingPayDate } from "../lib/incomePlan/payDates.ts";

const root = path.resolve(import.meta.dirname, "..");
const reference = new Date(2026, 9, 14, 12, 0, 0);

const plan = {
  id: "plan",
  paySchedule: "biweekly",
  paycheckAmount: 2400,
  anchorDate: "2026-01-02",
  weeklyDayOfWeek: null,
  monthlyDays: [],
  customIntervalDays: null,
  depositAccountId: "checking",
  nextPayDate: "2026-07-06",
  lastProcessedDate: null,
  isActive: true,
  allocations: [],
};

const upcoming = resolveUpcomingPayDate(plan, reference);
assert.equal(plan.nextPayDate, "2026-07-06");
assert.notEqual(upcoming, "2026-07-06");
assert.ok(upcoming >= "2026-10-14", upcoming);

const kept = resolveUpcomingPayDate(
  { ...plan, nextPayDate: "2026-10-30" },
  reference,
);
assert.equal(kept, "2026-10-30");

const finance = {
  ...emptyFinanceData,
  accounts: [
    {
      id: "checking",
      name: "Checking",
      institution: "Bank",
      type: "checking",
      balance: 1000,
      monthlyChange: 0,
      includeInNetWorth: true,
    },
  ],
  income: [
    {
      id: "salary",
      name: "Salary",
      amount: 2400,
      frequency: "monthly",
      category: "Paycheck",
      depositAccountId: "checking",
      schedule: {
        startDate: "2026-01-06",
        frequency: "monthly",
        nextOccurrence: "2026-07-06",
        lastProcessedDate: null,
        status: "active",
      },
    },
  ],
  incomePlan: plan,
};

const summary = getNextPaycheck(finance, reference);
assert.ok(summary);
assert.ok(summary.daysUntil >= 0, String(summary.daysUntil));
assert.doesNotMatch(summary.formattedDate, /Jul 6/);

const rows = getIncomeTableRows(finance, reference);
const salary = rows.find((row) => row.id === "salary");
assert.ok(salary);
assert.equal(salary.nextPayDate, "Nov 6, 2026");
assert.equal(finance.income[0].schedule.nextOccurrence, "2026-07-06");
assert.equal(finance.incomePlan.nextPayDate, "2026-07-06");

const forecast = forecastCashUntilPayday(finance, reference);
assert.ok(forecast.nextPayDate);
assert.ok(forecast.nextPayDate >= "2026-10-14");
assert.notEqual(forecast.nextPayDate, "2026-07-06");

const outlook = forecastCashOutlook(finance, reference);
const paycheckDates = outlook.events
  .filter((event) => event.kind === "paycheck")
  .map((event) => event.date);
assert.ok(paycheckDates.some((date) => date >= "2026-10-14" && date <= "2026-11-13"));
assert.ok(paycheckDates.every((date) => date !== "2026-07-06"));

const moneyPlan = buildMoneyPlan(finance, reference, []);
assert.equal(moneyPlan.incomePlan.nextPayDate, upcoming);
assert.equal(finance.incomePlan.nextPayDate, "2026-07-06");

const [year, month] = upcoming.split("-").map(Number);
const calendar = buildCalendarMonth(finance, year, month - 1, reference);
const payday = calendar.find((entry) => entry.date === upcoming);
assert.ok(payday?.events.some((event) => event.type === "allocation" || event.type === "income"));
const july = buildCalendarMonth(finance, 2026, 6, reference);
assert.equal(
  july.some((entry) => entry.events.some((event) => event.id.startsWith("paycheck-"))),
  false,
);

const weekly = forecastCashOutlook(
  {
    ...emptyFinanceData,
    accounts: finance.accounts,
    incomePlan: {
      ...plan,
      paySchedule: "weekly",
      anchorDate: "2025-01-06",
      weeklyDayOfWeek: 1,
      nextPayDate: "2025-01-06",
    },
  },
  reference,
);
assert.equal(weekly.events.some((event) => event.kind === "paycheck" && event.date === "2025-01-06"), false);
assert.ok(
  weekly.events.some(
    (event) => event.kind === "paycheck" && event.date >= "2026-10-14" && event.date <= "2026-11-13",
  ),
);

const applied = executePaycheckAllocations(finance, plan, {}, reference);
assert.equal(plan.nextPayDate, "2026-07-06");
assert.ok(applied.data.incomePlan.nextPayDate > upcoming);
assert.equal(applied.paycheckEvent.payDate, upcoming);

const incomeContent = fs.readFileSync(
  path.join(root, "components/income/IncomeContent.tsx"),
  "utf8",
);
const incomeRow = fs.readFileSync(
  path.join(root, "components/income/IncomeRow.tsx"),
  "utf8",
);
assert.doesNotMatch(incomeContent, /grid-cols-\[minmax/);
assert.doesNotMatch(incomeRow, /grid-cols-\[minmax/);
assert.match(incomeRow, /Mark received/);
assert.match(incomeRow, /Next payday/);
assert.match(incomeRow, /More/);

console.log("Income payday projection and source layout checks passed.");
