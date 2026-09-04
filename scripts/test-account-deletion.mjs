#!/usr/bin/env node
/**
 * Account deletion policy + App Review discoverability checks.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function resolveHouseholdDeletionRole(userId, snapshot) {
  if (!snapshot.householdId) return "none";
  const members = snapshot.memberUserIds.filter(Boolean);
  const isMember = members.includes(userId);
  const isOwner = snapshot.ownerId === userId;
  if (!isMember && !isOwner) return "none";
  if (isOwner) return members.length > 1 ? "owner_with_members" : "sole_owner";
  return "member";
}

function isStripeSubscriptionActiveForDeletion(input) {
  const status = input.subscriptionStatus ?? "none";
  const activeStatus =
    status === "active" || status === "trialing" || status === "past_due";
  if (!activeStatus || !input.stripeSubscriptionId) return false;
  const provider = input.subscriptionProvider ?? "none";
  return provider === "stripe" || provider === "none";
}

function isAppleManagedSubscription(input) {
  return (
    input.subscriptionProvider === "apple" ||
    Boolean(input.appleOriginalTransactionId)
  );
}

assert.equal(
  resolveHouseholdDeletionRole("u1", {
    householdId: null,
    ownerId: null,
    memberUserIds: [],
  }),
  "none",
);
assert.equal(
  resolveHouseholdDeletionRole("u1", {
    householdId: "h1",
    ownerId: "u1",
    memberUserIds: ["u1"],
  }),
  "sole_owner",
);
assert.equal(
  resolveHouseholdDeletionRole("u1", {
    householdId: "h1",
    ownerId: "u1",
    memberUserIds: ["u1", "u2"],
  }),
  "owner_with_members",
);
assert.equal(
  resolveHouseholdDeletionRole("u2", {
    householdId: "h1",
    ownerId: "u1",
    memberUserIds: ["u1", "u2"],
  }),
  "member",
);

assert.equal(
  isStripeSubscriptionActiveForDeletion({
    subscriptionProvider: "stripe",
    subscriptionStatus: "active",
    stripeSubscriptionId: "sub_123",
  }),
  true,
);
assert.equal(
  isStripeSubscriptionActiveForDeletion({
    subscriptionProvider: "apple",
    subscriptionStatus: "active",
    stripeSubscriptionId: "sub_123",
  }),
  false,
);
assert.equal(
  isAppleManagedSubscription({
    subscriptionProvider: "apple",
    appleOriginalTransactionId: "txn",
  }),
  true,
);

const policy = read("lib/account/deleteAccountPolicy.ts");
assert.match(policy, /owner_with_members/);
assert.match(policy, /Transfer household ownership/);
assert.match(policy, /isStripeSubscriptionActiveForDeletion/);
assert.match(policy, /isAppleManagedSubscription/);

const iosSettings = read("components/native/ios/IosSettingsScreen.tsx");
assert.match(iosSettings, /title="Account"/);
assert.match(iosSettings, /title="Delete Account"/);
assert.doesNotMatch(iosSettings, /Danger zone/);
assert.match(iosSettings, /openPanel\("delete-account"/);
assert.match(iosSettings, /AccountDeletionSection/);

const webSettings = read("components/settings/SettingsContent.tsx");
assert.match(webSettings, /id="account"/);
assert.match(webSettings, /title="Account"/);
assert.match(webSettings, /id="delete-account"/);
assert.match(webSettings, /AccountDeletionSection/);

const deletionUi = read("components/settings/AccountDeletionSection.tsx");
assert.match(deletionUi, /Delete Account/);
assert.match(deletionUi, /Type DELETE/);
assert.match(deletionUi, /APPLE_MANAGE_SUBSCRIPTIONS_URL/);
assert.match(deletionUi, /Stripe Buxme subscription will be canceled/);
assert.match(deletionUi, /does[\s\S]*not[\s\S]*cancel an App Store subscription/);
assert.match(deletionUi, /temporarily unavailable/);
assert.match(deletionUi, /\/api\/account\/delete/);

const route = read("app/api/account/delete/route.ts");
assert.match(route, /deleteUserAccount/);
assert.match(route, /confirm !== "DELETE"/);
assert.match(route, /AccountDeletionBlockedError/);
assert.match(route, /requireStripeApiUser/);
assert.match(route, /status: 409/);

const apiAuth = read("lib/stripe/apiAuth.ts");
assert.match(apiAuth, /Unauthorized/);
assert.match(apiAuth, /status: 401/);

const service = read("lib/account/deleteAccountService.ts");
assert.match(service, /auth\.admin\.deleteUser/);
assert.match(service, /subscriptions\.retrieve/);
assert.match(service, /subscriptions\.cancel/);
assert.doesNotMatch(service, /customers\.del\b|customers\.delete\b/);
assert.doesNotMatch(service, /cancelApple|App Store Server|refundApple/i);
assert.match(service, /HOUSEHOLD_OWNER_BLOCK_MESSAGE/);
assert.match(service, /factoryResetUserFinance/);
assert.match(service, /alreadyDeleted/);
assert.match(service, /from\("households"\)\.delete/);
assert.match(service, /sole_owner/);

console.log("✅ Account deletion checks passed.");
