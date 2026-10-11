#!/usr/bin/env node
/**
 * Stage 4: native Home leads with Safe to Spend, tab changes fade,
 * and the More sheet can be dismissed.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

const home = read("components/native/ios/IosHomeScreen.tsx");
const sheet = read("components/navigation/MobileMoreSheet.tsx");
const transition = read("components/PageTransition.tsx");
const css = read("app/globals.css");
const nav = read("components/MobileBottomNav.tsx");

assert.match(home, /data-home-hero="safe-to-spend"/);
assert.match(home, /from-\[var\(--accent-light\)\] to-\[var\(--accent-hover\)\]/);
assert.match(home, /Safe to Spend/);
assert.match(home, /variant="home"/);
assert.ok(
  home.indexOf("Safe to Spend") < home.indexOf(">Net Worth<"),
  "Home hero must lead with Safe to Spend, with Net Worth as a secondary metric",
);
assert.match(home, /href="\/accounts"/);
assert.match(home, /href="\/debt"/);
assert.match(home, /nextGoal/);
assert.match(home, /Upcoming/);
assert.match(home, /Recent/);

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

console.log("✅ Stage 4 premium Home checks passed.");
