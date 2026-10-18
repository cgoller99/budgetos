#!/usr/bin/env node
/**
 * Native UI 2.1: glanceable Home, refunds, goal time, and budget overview.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describeTimeRemaining } from "../lib/native/timeRemaining.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const now = new Date("2026-10-14T12:00:00.000Z");
assert.equal(describeTimeRemaining(null, now), "Set a weekly amount to estimate time remaining");
assert.equal(
  describeTimeRemaining(new Date("2026-10-16T12:00:00.000Z"), now),
  "2 days left",
);
assert.equal(
  describeTimeRemaining(new Date("2026-12-14T12:00:00.000Z"), now),
  "2 months left",
);

const home = read("components/native/ios/IosHomeScreen.tsx");
assert.match(home, /Available cash/);
assert.match(home, /data-home-hero="safe-to-spend"/);
assert.match(home, /<IosBudgetsSection \/>/);
assert.match(home, /describeTimeRemaining/);
assert.match(home, /href="\/income"/);
assert.match(home, /href="\/budgets"/);
assert.match(home, /detail="summary"/);
assert.match(home, /IosMerchantMark/);

const transactions = read("components/native/ios/IosTransactionsScreen.tsx");
assert.match(transactions, /isRefundActivity/);
assert.match(transactions, /value: "refunds"/);
assert.match(transactions, /type="search"/);
assert.match(transactions, /aria-label="Categories"/);
assert.match(transactions, /IosMerchantMark/);

const budgets = read("components/native/ios/IosBudgetsSection.tsx");
assert.match(budgets, /This month/);
assert.match(budgets, /over budget/);
assert.match(budgets, /Save limit/);
assert.match(budgets, /native-sheet-footer|footer=/);
assert.match(budgets, /pathname === "\/dashboard"/);
assert.match(budgets, /Edit limits/);
assert.match(budgets, /href="\/budgets"/);

const budgetsScreen = read("components/native/ios/IosBudgetsScreen.tsx");
assert.match(budgetsScreen, /Safe to Spend/);
assert.match(budgetsScreen, /IosBudgetsSection/);
const budgetsContent = read("components/budgets/BudgetsContent.tsx");
assert.match(budgetsContent, /IosBudgetsScreen/);
assert.match(budgetsContent, /nativeIos/);

const goals = read("components/native/ios/IosGoalsScreen.tsx");
assert.match(goals, /Time remaining/);
assert.match(goals, /GoalForecastPanel/);
assert.match(goals, /Add money/);
assert.match(goals, /IosRing/);
assert.match(goals, /LinkAccountModal/);
assert.match(goals, /compact/);

const plan = read("components/native/ios/IosIncomeScreen.tsx");
assert.match(plan, /Cash-flow outlook/);
assert.match(plan, /resolveUpcomingPayDate/);
assert.match(plan, /Confirm before allocations apply/);
assert.match(plan, /30-day low/);
assert.match(plan, /footer=/);

const marks = read("components/native/ios/IosMerchantMark.tsx");
assert.match(marks, /refund/);
assert.match(marks, /income/);
assert.match(marks, /spending|other/);

const css = read("app/globals.css");
assert.match(css, /html\[data-native-platform="ios"\] \.ios-home-hero/);
assert.match(css, /html\[data-native-platform="ios"\] \.native-page-back/);

console.log("Native UI 2.1 checks passed.");
