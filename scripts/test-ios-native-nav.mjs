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
assert.match(src, /href: "\/transactions"/);
assert.match(src, /href: "\/dashboard"/);
assert.match(src, /href: "\/accounts"/);
assert.match(src, /href: "\/bills"/);

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
assert.match(iosPrimary, /\/transactions/);
assert.doesNotMatch(iosPrimary, /\/income/);

const iosMore = src.slice(src.indexOf("IOS_MORE_NAV"));
assert.match(iosMore, /\/income/);
assert.match(iosMore, /\/settings/);
assert.match(iosMore, /Household/);

console.log("✅ iOS native navigation IA checks passed.");
