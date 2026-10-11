#!/usr/bin/env node
/**
 * Static checks for iOS Capacitor navigation IA.
 * Usage: npm run test:ios-native-nav
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const navPath = path.join(ROOT, "lib/mobile/navigation.ts");
const src = fs.readFileSync(navPath, "utf8");

assert.match(src, /export const IOS_PRIMARY_NAV/);
assert.match(src, /export const IOS_MORE_NAV/);
assert.match(src, /href: "\/dashboard"/);
assert.match(src, /href: "\/accounts"/);
assert.match(src, /href: "\/bills"/);
assert.match(src, /href: "\/debt"/);
assert.match(src, /href: "\/transactions"/);

// Web primary should still include Income (unchanged web mobile IA)
const webPrimary = src.slice(
  src.indexOf("MOBILE_PRIMARY_NAV"),
  src.indexOf("IOS_PRIMARY_NAV"),
);
assert.match(webPrimary, /\/income/);

const iosPrimary = src.slice(
  src.indexOf("IOS_PRIMARY_NAV"),
  src.indexOf("MOBILE_MORE_NAV"),
);
assert.match(iosPrimary, /label: "Home"/);
assert.match(iosPrimary, /label: "Transactions"/);
assert.match(iosPrimary, /label: "Plan"/);
assert.match(iosPrimary, /label: "Accounts"/);
assert.match(iosPrimary, /\/transactions/);
assert.match(iosPrimary, /\/income/);
assert.doesNotMatch(iosPrimary, /label: "Bills"/);
assert.doesNotMatch(iosPrimary, /label: "Debt"/);
assert.doesNotMatch(iosPrimary, /Activity/);

const iosMore = src.slice(src.indexOf("IOS_MORE_NAV"));
assert.match(iosMore, /\/bills/);
assert.match(iosMore, /label: "Debt"/);
assert.match(iosMore, /\/savings/);
assert.match(iosMore, /\/settings/);
assert.match(iosMore, /Household/);
assert.match(iosMore, /What's New/);
assert.match(iosMore, /Roadmap/);
assert.match(iosMore, /Support/);
assert.doesNotMatch(iosMore, /label: "Transactions"/);
assert.doesNotMatch(iosMore, /label: "Income"/);
// Household must not live under Insights (Build 7 Insights → Settings bug)
assert.doesNotMatch(
  iosMore.match(/href: "\/settings#household"[\s\S]*?group: "\w+"/)?.[0] ?? "",
  /insights/,
);

console.log("✅ iOS native navigation IA checks passed.");
