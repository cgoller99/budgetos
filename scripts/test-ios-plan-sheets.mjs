#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const income = fs.readFileSync(
  path.join(root, "components/native/ios/IosIncomeScreen.tsx"),
  "utf8",
);
const goals = fs.readFileSync(
  path.join(root, "components/native/ios/IosGoalsScreen.tsx"),
  "utf8",
);
const debt = fs.readFileSync(
  path.join(root, "components/native/ios/IosDebtScreen.tsx"),
  "utf8",
);

assert.match(income, /IosBottomSheet/);
assert.match(income, /Left to assign/);
assert.match(income, /resolveAllocationAmounts/);
assert.match(income, /Upcoming payday/);
assert.match(income, /Review plan/);
assert.match(income, /IosDonut/);
assert.match(income, /Upcoming paychecks/);
assert.match(income, /Mark received/);
assert.match(income, /setSelectedSource/);
assert.doesNotMatch(income, /onClick=\{\(\) => setEditIncomeId\(row\.id\)\}/);

assert.match(goals, /IosBottomSheet/);
assert.match(goals, /Add money/);
assert.match(goals, /Projected/);
assert.match(goals, /No goals yet/);
assert.match(goals, /Create Goal/);
assert.match(goals, /setSelectedGoalId/);
assert.match(goals, /monthlyContribution/);

assert.match(debt, /IosBottomSheet/);
assert.match(debt, /Record payment/);
assert.match(debt, /Add payment plan/);
assert.match(debt, /interestRate/);
assert.match(debt, /setSelectedDebtId/);
assert.doesNotMatch(debt, />\s*Pay\s*</);

console.log("✅ iOS income, goals, and debt sheet checks passed.");
