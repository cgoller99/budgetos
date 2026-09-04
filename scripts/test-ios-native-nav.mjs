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
assert.match(iosPrimary, /label: "Accounts"/);
assert.match(iosPrimary, /label: "Bills"/);
assert.match(iosPrimary, /label: "Debt"/);
assert.match(iosPrimary, /\/debt/);
assert.doesNotMatch(iosPrimary, /\/transactions/);
assert.doesNotMatch(iosPrimary, /Activity/);
assert.doesNotMatch(iosPrimary, /\/income/);

const iosMore = src.slice(src.indexOf("IOS_MORE_NAV"));
assert.match(iosMore, /\/income/);
assert.match(iosMore, /\/transactions/);
assert.match(iosMore, /\/settings/);
assert.match(iosMore, /Household/);
assert.match(iosMore, /What's New/);
assert.match(iosMore, /Roadmap/);
assert.match(iosMore, /Support/);
// Debt is a primary tab — must not appear again in More
assert.doesNotMatch(iosMore, /label: "Debt"/);
// Household must not live under Insights (Build 7 Insights → Settings bug)
assert.doesNotMatch(
  iosMore.match(/href: "\/settings#household"[\s\S]*?group: "\w+"/)?.[0] ?? "",
  /insights/,
);

console.log("✅ iOS native navigation IA checks passed.");
