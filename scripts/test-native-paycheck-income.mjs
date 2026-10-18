#!/usr/bin/env node
/**
 * Native Budgets/Income paycheck UI — engines preserved, embeds reduced.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const nativeDash = read("components/native/ios/IosPaycheckPlanDashboard.tsx");
assert.match(nativeDash, /buildPaycheckBreakdown/);
assert.match(nativeDash, /buildAccountForecasts/);
assert.match(nativeDash, /AllocationEditSheet/);
assert.match(nativeDash, /FORECAST_HORIZONS/);
assert.match(nativeDash, /data-ios-paycheck-plan/);
assert.match(nativeDash, /Edit Budget/);
assert.match(nativeDash, /Future Balances/);
assert.match(nativeDash, /Where money goes/);
assert.match(nativeDash, /My Accounts/);
assert.match(nativeDash, /Upcoming outflows/);
assert.match(nativeDash, /amountWeekly/);
assert.match(nativeDash, /openEdit\(/);
assert.doesNotMatch(nativeDash, /from "@\/components\/ui"/);
assert.doesNotMatch(nativeDash, /CardHeader/);

const budgets = read("components/native/ios/IosBudgetsScreen.tsx");
assert.match(budgets, /IosPaycheckPlanDashboard/);
assert.doesNotMatch(budgets, /from "@\/components\/budgets\/PaycheckPlanDashboard"/);

const income = read("components/native/ios/IosIncomeScreen.tsx");
assert.match(income, /AllocationEditSheet/);
assert.match(income, /IosPaycheckPlanDashboard/);
assert.match(income, /data-ios-income-plan-tab/);
assert.match(income, /data-ios-income-schedule-sheet/);
assert.match(income, /Edit allocations/);
// Full-page ios-embedded IncomePlanContent removed from plan/upcoming tabs
assert.doesNotMatch(income, /ios-embedded-panel \[&_\.page-header\]:hidden/);
// Setup/schedule still available via sheet (preserves wizard functionality)
assert.match(income, /IncomePlanContent embedded/);

// Web dashboard still exists for desktop
const webDash = read("components/budgets/PaycheckPlanDashboard.tsx");
assert.match(webDash, /buildPaycheckBreakdown/);
assert.match(webDash, /AllocationEditSheet/);

console.log("✅ Native paycheck/income UI checks passed.");
