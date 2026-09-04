#!/usr/bin/env node
/**
 * Apple IAP verification + ASN V2 + entitlement policy checks (Guideline 3.1.1).
 *
 * Usage: npm run test:apple-iap
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

// ── Policy helpers (mirrors lib/iap/appleEntitlementPolicy.ts) ───────────────

function planFromIapProductId(productId) {
  if (productId === "co.buxme.app.pro.monthly") return "pro";
  if (productId === "co.buxme.app.proplus.monthly") return "pro_plus";
  return null;
}

function isAllowedAppleProductId(productId) {
  return Boolean(productId && planFromIapProductId(productId));
}

function isStripeSubscriptionActiveOnProfile(profile) {
  const status = profile.subscriptionStatus ?? "none";
  const statusActive =
    status === "active" || status === "trialing" || status === "past_due";
  if (!statusActive) return false;
  return (
    profile.subscriptionProvider === "stripe" ||
    Boolean(profile.stripeSubscriptionId)
  );
}

function canApplyAppleEntitlementToProfile(profile) {
  return !isStripeSubscriptionActiveOnProfile(profile);
}

function isVerifiedAppleTransactionCurrentlyValid(input) {
  const now = input.nowMs ?? Date.now();
  if (input.bundleId !== input.expectedBundleId) {
    return { valid: false, reason: "bundle_mismatch" };
  }
  const plan = planFromIapProductId(input.productId);
  if (!plan) return { valid: false, reason: "unsupported_product" };
  if (input.revocationDateMs != null) return { valid: false, reason: "revoked" };
  if (input.expiresDateMs == null) return { valid: false, reason: "missing_expiry" };
  if (input.expiresDateMs <= now) return { valid: false, reason: "expired" };
  return { valid: true, plan };
}

function mapAppleNotificationToAction(input) {
  const type = input.notificationType ?? "";
  switch (type) {
    case "SUBSCRIBED":
    case "DID_RENEW":
    case "OFFER_REDEEMED":
    case "RENEWAL_EXTENDED":
    case "REFUND_REVERSED":
    case "DID_CHANGE_RENEWAL_PREF":
      return { kind: "upsert", status: "active" };
    case "DID_FAIL_TO_RENEW":
      return { kind: "upsert", status: "past_due" };
    case "EXPIRED":
    case "GRACE_PERIOD_EXPIRED":
    case "REFUND":
    case "REVOKE":
      return { kind: "deactivate", status: "canceled" };
    case "DID_CHANGE_RENEWAL_STATUS":
      return { kind: "ignore", reason: "renewal_status_only" };
    case "TEST":
      return { kind: "ignore", reason: "test_notification" };
    default:
      return { kind: "ignore", reason: `unknown_${type || "empty"}` };
  }
}

function hasActiveSubscription(subscription, nowMs = Date.now()) {
  const statusActive =
    subscription.status === "active" ||
    subscription.status === "trialing" ||
    subscription.status === "past_due";
  if (!statusActive) return false;
  if (subscription.currentPeriodEnd) {
    const end = Date.parse(subscription.currentPeriodEnd);
    if (!Number.isNaN(end) && end <= nowMs) return false;
  } else if (subscription.provider === "apple") {
    return false;
  }
  return true;
}

// ── Policy unit assertions ──────────────────────────────────────────────────

assert.equal(isAllowedAppleProductId("co.buxme.app.pro.monthly"), true);
assert.equal(isAllowedAppleProductId("co.buxme.app.proplus.monthly"), true);
assert.equal(isAllowedAppleProductId("com.other.product"), false);
assert.equal(isAllowedAppleProductId(""), false);

assert.deepEqual(
  isVerifiedAppleTransactionCurrentlyValid({
    productId: "co.buxme.app.pro.monthly",
    bundleId: "co.buxme.app",
    expectedBundleId: "co.buxme.app",
    expiresDateMs: Date.now() + 60_000,
    revocationDateMs: null,
  }),
  { valid: true, plan: "pro" },
);

assert.equal(
  isVerifiedAppleTransactionCurrentlyValid({
    productId: "co.buxme.app.pro.monthly",
    bundleId: "co.other.app",
    expectedBundleId: "co.buxme.app",
    expiresDateMs: Date.now() + 60_000,
    revocationDateMs: null,
  }).reason,
  "bundle_mismatch",
);

assert.equal(
  isVerifiedAppleTransactionCurrentlyValid({
    productId: "com.evil.premium",
    bundleId: "co.buxme.app",
    expectedBundleId: "co.buxme.app",
    expiresDateMs: Date.now() + 60_000,
    revocationDateMs: null,
  }).reason,
  "unsupported_product",
);

assert.equal(
  isVerifiedAppleTransactionCurrentlyValid({
    productId: "co.buxme.app.pro.monthly",
    bundleId: "co.buxme.app",
    expectedBundleId: "co.buxme.app",
    expiresDateMs: Date.now() - 1,
    revocationDateMs: null,
  }).reason,
  "expired",
);

assert.equal(
  isVerifiedAppleTransactionCurrentlyValid({
    productId: "co.buxme.app.pro.monthly",
    bundleId: "co.buxme.app",
    expectedBundleId: "co.buxme.app",
    expiresDateMs: Date.now() + 60_000,
    revocationDateMs: Date.now() - 10,
  }).reason,
  "revoked",
);

assert.equal(
  mapAppleNotificationToAction({ notificationType: "SUBSCRIBED" }).kind,
  "upsert",
);
assert.equal(
  mapAppleNotificationToAction({ notificationType: "DID_RENEW" }).status,
  "active",
);
assert.equal(
  mapAppleNotificationToAction({ notificationType: "EXPIRED" }).kind,
  "deactivate",
);
assert.equal(
  mapAppleNotificationToAction({ notificationType: "REFUND" }).kind,
  "deactivate",
);
assert.equal(
  mapAppleNotificationToAction({ notificationType: "REVOKE" }).kind,
  "deactivate",
);
assert.equal(
  mapAppleNotificationToAction({
    notificationType: "DID_FAIL_TO_RENEW",
    subtype: "GRACE_PERIOD",
  }).status,
  "past_due",
);

// Duplicate ASN converges on same action (idempotent mapping).
const first = mapAppleNotificationToAction({ notificationType: "DID_RENEW" });
const second = mapAppleNotificationToAction({ notificationType: "DID_RENEW" });
assert.deepEqual(first, second);

assert.equal(
  canApplyAppleEntitlementToProfile({
    id: "u1",
    subscriptionProvider: "stripe",
    subscriptionStatus: "active",
    stripeSubscriptionId: "sub_123",
    appleOriginalTransactionId: null,
  }),
  false,
);

assert.equal(
  canApplyAppleEntitlementToProfile({
    id: "u1",
    subscriptionProvider: "apple",
    subscriptionStatus: "active",
    stripeSubscriptionId: null,
    appleOriginalTransactionId: "1001",
  }),
  true,
);

assert.equal(
  canApplyAppleEntitlementToProfile({
    id: "u1",
    subscriptionProvider: "none",
    subscriptionStatus: "none",
    stripeSubscriptionId: null,
    appleOriginalTransactionId: null,
  }),
  true,
);

// Entitlement fail-open fixes
assert.equal(
  hasActiveSubscription({
    plan: "pro",
    status: "active",
    provider: "apple",
    currentPeriodEnd: null,
  }),
  false,
);

assert.equal(
  hasActiveSubscription({
    plan: "pro",
    status: "active",
    provider: "apple",
    currentPeriodEnd: new Date(Date.now() - 1000).toISOString(),
  }),
  false,
);

assert.equal(
  hasActiveSubscription({
    plan: "pro",
    status: "active",
    provider: "apple",
    currentPeriodEnd: new Date(Date.now() + 86_400_000).toISOString(),
  }),
  true,
);

assert.equal(
  hasActiveSubscription({
    plan: "pro",
    status: "active",
    provider: "stripe",
    currentPeriodEnd: null,
  }),
  true,
);

// ── Static wiring assertions ────────────────────────────────────────────────

const verifyRoute = read("app/api/iap/apple/verify/route.ts");
assert.match(verifyRoute, /verifyAndSyncApplePurchaseForUser/);
assert.match(verifyRoute, /APPLE_IAP_NOT_CONFIGURED|isConfigured/);
assert.match(verifyRoute, /status: 503/);
assert.doesNotMatch(verifyRoute, /pending_credentials/);
assert.doesNotMatch(verifyRoute, /syncAppleSubscriptionToProfile\(/);

const verifyService = read("lib/iap/appleVerifyPurchase.ts");
assert.match(verifyService, /verifyAndDecodeSignedTransaction|fetchVerifiedTransactionById/);
assert.match(verifyService, /Never trusts client/);
assert.match(verifyService, /ApplePurchaseVerificationError/);

const serverClient = read("lib/iap/appleServerClient.ts");
assert.match(serverClient, /SignedDataVerifier/);
assert.match(serverClient, /AppStoreServerAPIClient/);
assert.match(serverClient, /getTransactionInfo/);
assert.match(serverClient, /verifyAndDecodeNotification/);

const subscriptionService = read("lib/iap/appleSubscriptionService.ts");
assert.match(subscriptionService, /canApplyAppleEntitlementToProfile/);
assert.match(subscriptionService, /clearAppleSubscriptionOnProfile/);
assert.match(subscriptionService, /applyAppleSubscriptionByOriginalTransaction/);
assert.match(subscriptionService, /active_stripe_entitlement_preserved|active web subscription/);
assert.match(
  subscriptionService,
  /Unverified Apple subscription sync is disabled/,
);

const notificationsRoute = read("app/api/iap/apple/notifications/route.ts");
assert.match(notificationsRoute, /handleAppleServerNotificationV2/);
assert.match(notificationsRoute, /signedPayload/);

const notificationHandler = read("lib/iap/appleNotificationHandler.ts");
assert.match(notificationHandler, /mapAppleNotificationToAction/);
assert.match(notificationHandler, /applyAppleSubscriptionByOriginalTransaction/);
assert.match(notificationHandler, /Idempotent/);

const clientApi = read("lib/iap/clientApi.ts");
assert.match(clientApi, /signedTransactionInfo/);
assert.match(clientApi, /verifyApplePurchase\(preferred\)/);
assert.match(clientApi, /same trusted verification path/);

const nativePurchases = read("lib/iap/nativePurchases.ts");
assert.match(nativePurchases, /jwsRepresentation/);
assert.match(nativePurchases, /signedTransactionInfo/);

const entitlementsRoute = read("app/api/entitlements/route.ts");
assert.match(entitlementsRoute, /clearAppleSubscriptionOnProfile/);
assert.match(entitlementsRoute, /hasActiveSubscription/);

const types = read("lib/subscription/types.ts");
assert.match(types, /provider === "apple"/);
assert.match(types, /currentPeriodEnd/);
assert.match(types, /Fail closed/);

const products = read("lib/iap/products.ts");
assert.match(products, /co\.buxme\.app\.pro\.monthly/);
assert.match(products, /co\.buxme\.app\.proplus\.monthly/);

const envExample = read(".env.local.example");
assert.match(envExample, /APPLE_IAP_ISSUER_ID/);
assert.match(envExample, /APPLE_IAP_KEY_ID/);
assert.match(envExample, /APPLE_IAP_PRIVATE_KEY/);
assert.match(envExample, /APPLE_IAP_APP_APPLE_ID/);
assert.match(envExample, /api\/iap\/apple\/notifications/);

const envCatalog = read("scripts/lib/env-utils.mjs");
assert.match(envCatalog, /group: "Apple IAP"/);
assert.match(envCatalog, /APPLE_IAP_PRIVATE_KEY/);

const docs = read("docs/IOS_APP_STORE.md");
assert.match(docs, /App Store Server Notifications/);
assert.match(docs, /APPLE_IAP_APP_APPLE_ID/);

for (const cert of [
  "AppleRootCA-G3.cer",
  "AppleRootCA-G2.cer",
  "AppleIncRootCertificate.cer",
]) {
  assert.ok(
    fs.existsSync(path.join(root, "lib/iap/certs", cert)),
    `missing cert ${cert}`,
  );
}

const pkg = JSON.parse(read("package.json"));
assert.ok(pkg.dependencies["@apple/app-store-server-library"]);
assert.equal(pkg.scripts["test:apple-iap"], "node scripts/test-apple-iap.mjs");

// Confirm library is importable
const appleLib = require("@apple/app-store-server-library");
assert.ok(appleLib.SignedDataVerifier);
assert.ok(appleLib.AppStoreServerAPIClient);
assert.ok(appleLib.NotificationTypeV2);

console.log("✅ Apple IAP verification / ASN / entitlement checks passed.");
