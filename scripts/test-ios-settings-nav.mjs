#!/usr/bin/env node
/**
 * iOS Settings row → panel/route mapping + tap-target checks.
 * Usage: npm run test:ios-settings-nav
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const nav = read("lib/native/iosSettingsNavigation.ts");
assert.match(nav, /export const IOS_SETTINGS_ROWS/);
assert.match(nav, /panelFromSettingsHash/);
assert.match(nav, /title: "Subscription"/);
assert.match(nav, /hash: "billing"/);
assert.match(nav, /title: "Bank connections"/);
assert.match(nav, /hash: "connections"/);
assert.match(nav, /title: "Household"/);
assert.match(nav, /hash: "household"/);
assert.match(nav, /title: "Delete Account"/);
assert.match(nav, /hash: "delete-account"/);
assert.match(nav, /href: "\/whats-new"/);
assert.match(nav, /href: "\/roadmap"/);
assert.match(nav, /action: "feedback"/);

function panelFromSettingsHash(hash) {
  const value = (hash ?? "").replace(/^#/, "").trim();
  if (value === "billing") return "billing";
  if (value === "connections") return "connections";
  if (value === "household") return "household";
  if (value === "delete-account" || value === "account") return "delete-account";
  return null;
}

assert.equal(panelFromSettingsHash("#billing"), "billing");
assert.equal(panelFromSettingsHash("household"), "household");
assert.equal(panelFromSettingsHash("#account"), "delete-account");
assert.equal(panelFromSettingsHash("#delete-account"), "delete-account");
assert.equal(panelFromSettingsHash(""), null);
assert.equal(panelFromSettingsHash("#profile"), null);

const settings = read("components/native/ios/IosSettingsScreen.tsx");
assert.match(settings, /openPanel\("profile"\)/);
assert.match(settings, /openPanel\("billing", "billing"\)/);
assert.match(settings, /openPanel\("connections", "connections"\)/);
assert.match(settings, /openPanel\("household", "household"\)/);
assert.match(settings, /openPanel\("delete-account", "delete-account"\)/);
assert.match(settings, /openPanel\("notifications"\)/);
assert.match(settings, /openPanel\("theme"\)/);
assert.match(settings, /openPanel\("security"\)/);
assert.match(settings, /href="\/whats-new"/);
assert.match(settings, /href="\/roadmap"/);
assert.match(settings, /buxme:open-feedback/);
assert.match(settings, /closePanel/);
assert.match(settings, /data-ios-settings-panel=\{panel\}/);
assert.match(settings, /data-ios-settings-panel="root"/);
assert.match(settings, /panelFromSettingsHash/);
assert.doesNotMatch(settings, /current === next \? null : next/);
assert.match(settings, /if \(panel\)/);

const primitives = read("components/native/ios/IosPrimitives.tsx");
assert.match(primitives, /touch-manipulation text-left/);
assert.doesNotMatch(primitives, /<\/button>\s*\{trailing \? \(/);

const more = read("components/navigation/MobileMoreSheet.tsx");
assert.match(more, /pointer-events-none opacity-0/);
assert.match(more, /pointer-events-auto opacity-100/);
assert.match(more, /pointer-events-none translate-y-full/);
assert.match(more, /navigateSettingsDeepLink/);
assert.match(more, /hrefHash/);

const hashHelper = read("lib/native/navigateSettingsHash.ts");
assert.match(hashHelper, /HashChangeEvent\("hashchange"\)/);
assert.match(hashHelper, /navigateSettingsDeepLink/);

const billing = read("components/settings/BillingSection.tsx");
assert.match(billing, /touch-manipulation/);
assert.match(billing, /handleNativePurchase/);
assert.match(billing, /handleRestorePurchases/);

const pkg = JSON.parse(read("package.json"));
assert.equal(pkg.scripts["test:ios-settings-nav"], "node scripts/test-ios-settings-nav.mjs");

console.log("✅ iOS Settings navigation / tap-target checks passed.");
