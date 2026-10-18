#!/usr/bin/env node
/**
 * Native Income History + schedule editor — engines preserved, web embeds removed on iOS.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

const history = read("components/native/ios/IosIncomeHistoryPanel.tsx");
assert.match(history, /data-ios-income-history/);
assert.match(history, /ledgerAuditTrail/);
assert.match(history, /ledgerReport/);
assert.match(history, /snapshot\.forecasts|forecasts/);
assert.match(history, /History filters|FILTER_OPTIONS/);
assert.match(history, /data-ios-income-history-detail/);
assert.doesNotMatch(history, /from "@\/components\/ui"/);
assert.doesNotMatch(history, /CardHeader/);
assert.doesNotMatch(history, /IncomeLedgerPanel/);
assert.doesNotMatch(history, /IncomeForecastPanel/);

const schedule = read("components/native/ios/IosIncomeScheduleSheet.tsx");
assert.match(schedule, /data-ios-income-schedule-sheet/);
assert.match(schedule, /saveIncomePlan/);
assert.match(schedule, /SaveIncomePlanInput/);
assert.match(schedule, /computeNextPayDate/);
assert.match(schedule, /weekly/);
assert.match(schedule, /biweekly/);
assert.match(schedule, /twice_monthly/);
assert.match(schedule, /monthly/);
assert.match(schedule, /custom/);
assert.match(schedule, /Save schedule|Save plan/);
assert.doesNotMatch(schedule, /from "@\/components\/incomePlan\/IncomePlanContent"/);

const income = read("components/native/ios/IosIncomeScreen.tsx");
assert.match(income, /IosIncomeHistoryPanel/);
assert.match(income, /IosIncomeScheduleSheet/);
assert.doesNotMatch(income, /IncomeLedgerPanel/);
assert.doesNotMatch(income, /IncomeForecastPanel/);
assert.doesNotMatch(income, /IncomePlanContent/);
assert.doesNotMatch(income, /ios-embedded-panel/);

const debt = read("components/native/ios/IosDebtScreen.tsx");
assert.match(debt, /data-debt-detail-footer/);
assert.match(debt, /footer=\{/);

const accountSheet = read("components/native/ios/IosAccountDetailSheet.tsx");
assert.match(accountSheet, /data-account-detail-footer/);

// Web panels remain for desktop hub
assert.match(read("components/income/IncomeLedgerPanel.tsx"), /formatLedgerEntry/);
assert.match(read("components/incomePlan/IncomePlanContent.tsx"), /saveIncomePlan/);

console.log("✅ Native income history + schedule checks passed.");
