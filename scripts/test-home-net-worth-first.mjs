#!/usr/bin/env node
/**
 * P1: Home leads with authoritative Net Worth above Safe to Spend.
 * No fabricated historical charts; Capacitor iOS uses IosHomeScreen.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(ROOT, relativePath), "utf8");

const dashboard = read("components/DashboardContent.tsx");
const home = read("components/native/ios/IosHomeScreen.tsx");
const hero = read("components/native/ios/IosNetWorthHero.tsx");
const webCard = read("components/dashboard/HomeNetWorthCard.tsx");
const kpiHero = read("components/dashboard/DashboardHero.tsx");
const platform = read("lib/native/useNativeIos.ts");

assert.match(dashboard, /nativeIos/);
assert.match(dashboard, /IosHomeScreen/);
assert.match(dashboard, /HomeNetWorthCard/);
assert.match(platform, /isNativeIos/);

assert.match(hero, /calculateNetWorth\(finance\)/);
assert.match(hero, /calculateAssets/);
assert.match(hero, /calculateLiabilities/);
assert.match(hero, /hasHistoricalBalanceSeries = false/);
assert.match(hero, /data-home-hero="net-worth"/);
assert.match(hero, /href="\/accounts"/);
assert.doesNotMatch(hero, /buildTimeline/);

assert.match(webCard, /calculateNetWorth\(finance\)/);
assert.match(webCard, /hasHistoricalBalanceSeries = false/);
assert.match(webCard, /data-home-hero="net-worth"/);
assert.doesNotMatch(webCard, /buildTimeline/);

assert.match(home, /<IosNetWorthHero/);
assert.match(home, /data-home-section="safe-to-spend"/);
assert.match(home, /data-home-section="available-cash"/);
assert.ok(home.indexOf("<IosNetWorthHero") < home.indexOf("Safe to Spend"));
assert.ok(
  home.indexOf('data-home-section="safe-to-spend"') <
    home.indexOf('data-home-section="available-cash"'),
);
assert.ok(home.indexOf("Available Cash") < home.indexOf("Next Paycheck"));
assert.ok(home.indexOf("Next Paycheck") < home.indexOf("<IosBudgetsSection"));
assert.ok(home.indexOf("<IosBudgetsSection") < home.indexOf("Savings Goals"));
assert.ok(home.indexOf("Savings Goals") < home.indexOf("Upcoming Bills"));
assert.ok(home.indexOf("Upcoming Bills") < home.indexOf("Debt Progress"));

// No duplicate Net Worth chip on iOS Home
assert.doesNotMatch(home, />Net Worth</);
assert.doesNotMatch(home, /kpiMetrics\.find\(\(metric\) => metric\.label === "Net Worth"\)/);

// Desktop KPI row must not re-show Net Worth (centerpiece is HomeNetWorthCard)
assert.doesNotMatch(kpiHero, /label: "Net Worth"/);

console.log("✅ Home Net Worth-first checks passed.");
