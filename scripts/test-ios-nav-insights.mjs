#!/usr/bin/env node
/**
 * Build 7: iOS More/Insights navigation must not silently dump users into Settings.
 * Usage: npm run test:ios-nav-insights
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const nav = read("lib/mobile/navigation.ts");
const iosMore = nav.slice(nav.indexOf("export const IOS_MORE_NAV"));

assert.match(iosMore, /href: "\/reports",[\s\S]*?group: "insights"/);
assert.match(iosMore, /href: "\/calendar",[\s\S]*?group: "insights"/);
assert.match(iosMore, /href: "\/settings#household",[\s\S]*?group: "app"/);
assert.doesNotMatch(iosMore, /href: "\/settings#household",[\s\S]*?group: "insights"/);
assert.doesNotMatch(iosMore, /href: "\/settings",[\s\S]*?group: "insights"/);

const plans = read("lib/subscription/plans.ts");
assert.match(plans, /PRO_PLUS_ROUTE_PREFIXES = \[\]/);
assert.doesNotMatch(plans, /PRO_PLUS_ROUTE_PREFIXES = \["\/reports"\]/);
assert.doesNotMatch(plans, /"\/reports"/);

function getRequiredPlanForPath(pathname, prefixes = []) {
  if (
    prefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  ) {
    return "pro_plus";
  }
  return null;
}

assert.equal(getRequiredPlanForPath("/reports", []), null);
assert.equal(getRequiredPlanForPath("/reports", ["/reports"]), "pro_plus");

const moreSheet = read("components/navigation/MobileMoreSheet.tsx");
assert.match(moreSheet, /navigateSettingsDeepLink/);

const hashHelper = read("lib/native/navigateSettingsHash.ts");
assert.match(hashHelper, /HashChangeEvent\("hashchange"\)/);

console.log("✅ iOS Insights navigation regression checks passed.");
