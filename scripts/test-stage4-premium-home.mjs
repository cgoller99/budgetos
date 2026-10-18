#!/usr/bin/env node
/**
 * Premium Home: Net Worth first, Safe to Spend second, native chrome intact.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

const home = read("components/native/ios/IosHomeScreen.tsx");
const hero = read("components/native/ios/IosNetWorthHero.tsx");
const sheet = read("components/navigation/MobileMoreSheet.tsx");
const transition = read("components/PageTransition.tsx");
const css = read("app/globals.css");
const nav = read("components/MobileBottomNav.tsx");
const dashboard = read("components/DashboardContent.tsx");

assert.match(hero, /data-home-hero="net-worth"/);
assert.match(hero, /calculateNetWorth/);
assert.match(hero, /hasHistoricalBalanceSeries = false/);
assert.match(hero, /Total Net Worth/);
assert.match(hero, /href="\/accounts"/);
assert.match(hero, /from-\[var\(--accent-light\)\] to-\[var\(--accent-hover\)\]/);

assert.match(home, /IosNetWorthHero/);
assert.match(home, /data-home-section="safe-to-spend"/);
assert.match(home, /data-home-section="available-cash"/);
assert.match(home, /Safe to Spend/);
assert.match(home, /Available Cash/);
assert.match(home, /variant="home"/);
assert.ok(
  home.indexOf("<IosNetWorthHero") < home.indexOf('data-home-section="safe-to-spend"'),
  "Home must lead with Net Worth above Safe to Spend",
);
assert.ok(
  home.indexOf('data-home-section="safe-to-spend"') <
    home.indexOf('data-home-section="available-cash"'),
  "Safe to Spend must sit above Available Cash",
);
assert.equal(
  (home.match(/Total Net Worth|IosNetWorthHero/g) || []).length > 0,
  true,
);
// No secondary Net Worth chip/duplicate on Home
assert.doesNotMatch(home, />Net Worth</);
assert.match(home, /href="\/income"/);
assert.match(home, /href="\/debt"/);
assert.match(home, /nextGoal/);
assert.match(home, /Upcoming Bills/);
assert.match(home, /Debt Progress/);
assert.match(home, /IosBudgetsSection/);

assert.match(dashboard, /HomeNetWorthCard/);
assert.match(dashboard, /nativeIos \? <IosHomeScreen/);

assert.match(transition, /native-tab-enter/);
assert.match(transition, /IOS_PRIMARY_NAV/);
assert.match(transition, /native-page-enter/);

assert.match(sheet, /data-sheet-handle="true"/);
assert.match(sheet, /Escape/);
assert.match(sheet, /lockBodyScroll/);
assert.match(sheet, /dragOffsetRef\.current > 96/);

assert.match(nav, /native-tab-active/);
assert.match(css, /native-tab-enter/);
assert.match(css, /prefers-reduced-motion: reduce/);
assert.match(css, /\.ios-metric-chip/);

console.log("✅ Stage 4 premium Home checks passed (Net Worth first).");
