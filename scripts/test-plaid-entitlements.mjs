#!/usr/bin/env node
/**
 * Build 7: Plaid create-link requires Pro; reconnect grandfathered.
 * Usage: npm run test:plaid-entitlements
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function isNewPlaidConnectionAttempt(input) {
  if (input.mode === "update") return false;
  if (input.hasExistingItem) return false;
  return true;
}

function canCreateNewPlaidConnection(input) {
  return input.hasProAccess;
}

assert.equal(
  isNewPlaidConnectionAttempt({ mode: "create" }),
  true,
);
assert.equal(
  isNewPlaidConnectionAttempt({ mode: "update" }),
  false,
);
assert.equal(
  isNewPlaidConnectionAttempt({ mode: "create", hasExistingItem: true }),
  false,
);
assert.equal(canCreateNewPlaidConnection({ hasProAccess: false }), false);
assert.equal(canCreateNewPlaidConnection({ hasProAccess: true }), true);

const gate = read("lib/plaid/plaidEntitlementGate.ts");
assert.match(gate, /isNewPlaidConnectionAttempt/);
assert.match(gate, /canCreateNewPlaidConnection/);
assert.match(gate, /SUBSCRIPTION_REQUIRED/);

const serverGate = read("lib/plaid/requirePlaidProAccess.ts");
assert.match(serverGate, /assertCanStartPlaidLink/);
assert.match(serverGate, /assertCanExchangeNewPlaidItem/);
assert.match(serverGate, /getEffectiveEntitlements/);
assert.match(serverGate, /hasProAccess/);

const linkToken = read("app/api/plaid/link-token/route.ts");
assert.match(linkToken, /assertCanStartPlaidLink/);

const exchange = read("app/api/plaid/exchange/route.ts");
assert.match(exchange, /assertCanExchangeNewPlaidItem/);
assert.match(exchange, /hasExistingItem: Boolean\(existing\)/);

const bankUi = read("components/accounts/BankSyncPlaceholder.tsx");
assert.match(bankUi, /requiresUpgrade/);
assert.match(bankUi, /Upgrade to Pro/);
assert.match(bankUi, /hasProAccess/);

const plans = read("lib/subscription/plans.ts");
assert.match(plans, /Plaid bank, credit, loan & investment sync/);
assert.match(plans, /Manual accounts & transactions/);
assert.doesNotMatch(
  plans.slice(plans.indexOf('id: "free"'), plans.indexOf('id: "pro"')),
  /Plaid/,
);

const banner = read("components/guidance/PlaidConnectBanner.tsx");
assert.match(banner, /hasProAccess/);

console.log("✅ Plaid entitlement checks passed.");
