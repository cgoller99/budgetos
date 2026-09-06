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
  if (productId === "com.buxme.pro.monthly") return "pro";
  if (productId === "com.buxme.proplus.monthly") return "pro_plus";
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

function shouldPreserveHigherApplePlan(input) {
  if (input.currentProvider !== "apple") return false;
  const status = input.currentStatus ?? "none";
  if (status !== "active" && status !== "past_due" && status !== "trialing") return false;
  const rank = { free: 0, pro: 1, pro_plus: 2 };
  const currentRank = rank[input.currentPlan] ?? 0;
  const incomingRank = rank[input.incomingPlan] ?? 0;
  if (incomingRank >= currentRank) return false;
  const currentOtid = (input.currentOriginalTransactionId || "").trim();
  const incomingOtid = (input.incomingOriginalTransactionId || "").trim();
  if (currentOtid && incomingOtid && currentOtid === incomingOtid) return false;
  return true;
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
  const subtype = input.subtype ?? "";
  switch (type) {
    case "SUBSCRIBED":
    case "DID_RENEW":
    case "OFFER_REDEEMED":
    case "RENEWAL_EXTENDED":
    case "REFUND_REVERSED":
      return { kind: "upsert", status: "active" };
    case "DID_CHANGE_RENEWAL_PREF":
      if (subtype === "DOWNGRADE") {
        return { kind: "ignore", reason: "renewal_pref_downgrade_deferred" };
      }
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveAppAccountTokenOwnership(input) {
  if (!input.authenticatedUserId || !UUID_RE.test(input.authenticatedUserId)) {
    return { allowed: false, reason: "invalid_user_id" };
  }
  const token = input.appAccountToken?.trim();
  if (!token) {
    return { allowed: true, mode: "legacy_absent" };
  }
  if (token.toLowerCase() !== input.authenticatedUserId.toLowerCase()) {
    return { allowed: false, reason: "app_account_token_mismatch" };
  }
  return { allowed: true, mode: "bound" };
}

function productionIsConfigured(env) {
  const hasCreds = Boolean(env.issuerId && env.keyId && env.privateKey);
  const preferred = (env.environment || "Production").toLowerCase();
  if (preferred === "sandbox") {
    return hasCreds;
  }
  return hasCreds && Boolean(env.appAppleId);
}

// ── Policy unit assertions ──────────────────────────────────────────────────

assert.equal(isAllowedAppleProductId("com.buxme.pro.monthly"), true);
assert.equal(isAllowedAppleProductId("com.buxme.proplus.monthly"), true);
assert.equal(isAllowedAppleProductId("com.other.product"), false);
assert.equal(isAllowedAppleProductId(""), false);

const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";

assert.deepEqual(
  resolveAppAccountTokenOwnership({
    authenticatedUserId: userA,
    appAccountToken: userA,
  }),
  { allowed: true, mode: "bound" },
);
assert.equal(
  resolveAppAccountTokenOwnership({
    authenticatedUserId: userA,
    appAccountToken: userB,
  }).reason,
  "app_account_token_mismatch",
);
assert.deepEqual(
  resolveAppAccountTokenOwnership({
    authenticatedUserId: userA,
    appAccountToken: null,
  }),
  { allowed: true, mode: "legacy_absent" },
);
assert.deepEqual(
  resolveAppAccountTokenOwnership({
    authenticatedUserId: userA,
    appAccountToken: "",
  }),
  { allowed: true, mode: "legacy_absent" },
);

assert.equal(
  productionIsConfigured({
    issuerId: "iss",
    keyId: "key",
    privateKey: "pem",
    appAppleId: null,
    environment: "Production",
  }),
  false,
);
assert.equal(
  productionIsConfigured({
    issuerId: "iss",
    keyId: "key",
    privateKey: "pem",
    appAppleId: "123",
    environment: "Production",
  }),
  true,
);
assert.equal(
  productionIsConfigured({
    issuerId: "iss",
    keyId: "key",
    privateKey: "pem",
    appAppleId: null,
    environment: "Sandbox",
  }),
  true,
);

assert.deepEqual(
  isVerifiedAppleTransactionCurrentlyValid({
    productId: "com.buxme.pro.monthly",
    bundleId: "co.buxme.app",
    expectedBundleId: "co.buxme.app",
    expiresDateMs: Date.now() + 60_000,
    revocationDateMs: null,
  }),
  { valid: true, plan: "pro" },
);

assert.equal(
  isVerifiedAppleTransactionCurrentlyValid({
    productId: "com.buxme.pro.monthly",
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
    productId: "com.buxme.pro.monthly",
    bundleId: "co.buxme.app",
    expectedBundleId: "co.buxme.app",
    expiresDateMs: Date.now() - 1,
    revocationDateMs: null,
  }).reason,
  "expired",
);

assert.equal(
  isVerifiedAppleTransactionCurrentlyValid({
    productId: "com.buxme.pro.monthly",
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
assert.equal(
  shouldPreserveHigherApplePlan({
    currentProvider: "apple",
    currentStatus: "active",
    currentPlan: "pro_plus",
    currentOriginalTransactionId: "ot-high",
    incomingPlan: "pro",
    incomingOriginalTransactionId: "ot-low",
  }),
  true,
);
assert.equal(
  shouldPreserveHigherApplePlan({
    currentProvider: "apple",
    currentStatus: "active",
    currentPlan: "pro_plus",
    currentOriginalTransactionId: "ot-same",
    incomingPlan: "pro",
    incomingOriginalTransactionId: "ot-same",
  }),
  false,
);
assert.equal(
  shouldPreserveHigherApplePlan({
    currentProvider: "apple",
    currentStatus: "active",
    currentPlan: "pro",
    currentOriginalTransactionId: "ot-1",
    incomingPlan: "pro_plus",
    incomingOriginalTransactionId: "ot-2",
  }),
  false,
);
assert.equal(
  mapAppleNotificationToAction({
    notificationType: "DID_CHANGE_RENEWAL_PREF",
    subtype: "DOWNGRADE",
  }).kind,
  "ignore",
);
assert.equal(
  mapAppleNotificationToAction({
    notificationType: "DID_CHANGE_RENEWAL_PREF",
    subtype: "UPGRADE",
  }).kind,
  "upsert",
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
assert.match(verifyService, /resolveAppAccountTokenOwnership/);
assert.match(verifyService, /app_account_token_mismatch/);
assert.match(verifyService, /ownership audit log failed|Apple IAP ownership rejected/);
assert.match(verifyService, /logAdminEvent/);
assert.doesNotMatch(verifyService, /receipt\?:/);

const ownershipPolicy = read("lib/iap/appleEntitlementPolicy.ts");
assert.match(ownershipPolicy, /resolveAppAccountTokenOwnership/);
assert.match(ownershipPolicy, /legacy_absent/);
assert.match(ownershipPolicy, /LEGACY \/ RESTORE/);
assert.match(ownershipPolicy, /shouldPreserveHigherApplePlan/);
assert.match(ownershipPolicy, /renewal_pref_downgrade_deferred/);

const config = read("lib/iap/config.ts");
assert.match(config, /productionRequiresAppAppleId|APPLE_IAP_APP_APPLE_ID/);
assert.match(config, /Environment\.PRODUCTION/);
assert.match(config, /Environment\.SANDBOX/);
assert.match(config, /normalizePrivateKey/);
assert.match(config, /stripWrappingQuotes/);
assert.match(config, /getAppleIapConfigDiagnostics/);
assert.match(config, /\\\\r\\\\n/);

// ── Env parsing (mirrors lib/iap/config.ts; no secrets) ─────────────────────

function stripWrappingQuotes(raw) {
  const value = raw.trim();
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1).trim();
    }
  }
  return value;
}

function normalizePrivateKey(raw) {
  if (raw == null) return null;
  let value = stripWrappingQuotes(raw);
  if (!value) return null;
  if (value.includes("\\r\\n")) value = value.replace(/\\r\\n/g, "\n");
  if (value.includes("\\n")) value = value.replace(/\\n/g, "\n");
  if (value.includes("\r\n")) value = value.replace(/\r\n/g, "\n");
  else if (value.includes("\r")) value = value.replace(/\r/g, "\n");
  return value.trim() ? value : null;
}

function parseAppAppleId(raw) {
  if (raw == null) return null;
  const value = stripWrappingQuotes(raw);
  if (!value) return null;
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

assert.equal(
  normalizePrivateKey("-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n")?.includes(
    "\n",
  ),
  true,
);
assert.equal(
  normalizePrivateKey(
    '"-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n"',
  )?.startsWith("-----BEGIN"),
  true,
);
assert.equal(normalizePrivateKey("   "), null);
assert.equal(parseAppAppleId("6799452001"), 6799452001);
assert.equal(parseAppAppleId('"6799452001"'), 6799452001);
assert.equal(parseAppAppleId("'6799452001'"), 6799452001);
assert.equal(parseAppAppleId("App Apple ID 6799452001"), 6799452001);
assert.equal(parseAppAppleId("co.buxme.app"), null);

const serverClient = read("lib/iap/appleServerClient.ts");
assert.match(serverClient, /SignedDataVerifier/);
assert.match(serverClient, /AppStoreServerAPIClient/);
assert.match(serverClient, /getTransactionInfo/);
assert.match(serverClient, /verifyAndDecodeNotification/);

const subscriptionService = read("lib/iap/appleSubscriptionService.ts");
assert.match(subscriptionService, /canApplyAppleEntitlementToProfile/);
assert.match(subscriptionService, /clearAppleSubscriptionOnProfile/);
assert.match(subscriptionService, /applyAppleSubscriptionByOriginalTransaction/);
assert.match(subscriptionService, /already linked to another Buxme account/);
assert.match(subscriptionService, /apple_original_transaction_conflict|OTID conflict/);
assert.match(subscriptionService, /active_stripe_entitlement_preserved|active web subscription/);
assert.match(subscriptionService, /shouldPreserveHigherApplePlan/);
assert.match(
  subscriptionService,
  /Unverified Apple subscription sync is disabled/,
);

const notificationsRoute = read("app/api/iap/apple/notifications/route.ts");
assert.match(notificationsRoute, /handleAppleServerNotificationV2/);
assert.match(notificationsRoute, /signedPayload/);
assert.match(notificationsRoute, /getAppleIapConfigDiagnostics/);
assert.match(notificationsRoute, /diagnostics/);

const notificationHandler = read("lib/iap/appleNotificationHandler.ts");
assert.match(notificationHandler, /mapAppleNotificationToAction/);
assert.match(notificationHandler, /applyAppleSubscriptionByOriginalTransaction/);
assert.match(notificationHandler, /Idempotent/);

const clientApi = read("lib/iap/clientApi.ts");
assert.match(clientApi, /signedTransactionInfo/);
assert.match(clientApi, /purchaseAndVerifyNativePlan\([\s\S]*authenticatedUserId/);
assert.match(clientApi, /verifyApplePurchase\(preferred\)/);
assert.match(clientApi, /same trusted verification path/);
assert.doesNotMatch(clientApi, /receipt:/);

const nativePurchases = read("lib/iap/nativePurchases.ts");
assert.match(nativePurchases, /jwsRepresentation/);
assert.match(nativePurchases, /signedTransactionInfo/);
assert.match(nativePurchases, /appAccountToken: authenticatedUserId/);
assert.match(nativePurchases, /isBuxmeUserUuid/);
assert.match(nativePurchases, /peekOriginalTransactionIdFromJws/);
assert.match(nativePurchases, /Never fall back to transactionId/);
assert.doesNotMatch(
  nativePurchases,
  /originalId \?\? item\.transactionId/,
);

assert.match(nativePurchases, /getNativeStoreProducts/);
assert.match(nativePurchases, /priceString/);
assert.match(nativePurchases, /getProducts/);

const verifyPurchase = read("lib/iap/appleVerifyPurchase.ts");
assert.match(verifyPurchase, /verifiedViaJws/);
assert.match(verifyPurchase, /original_transaction_mismatch/);

const billing = read("components/settings/BillingSection.tsx");
assert.match(billing, /purchaseAndVerifyNativePlan\(plan, user\.id\)/);
assert.match(billing, /useAuth/);
assert.match(billing, /getNativeStoreProducts/);
assert.match(billing, /priceString/);
assert.match(billing, /storeCatalogStatus/);
assert.match(billing, /com\.buxme\.pro\.monthly/);

const entitlementsRoute = read("app/api/entitlements/route.ts");
assert.match(entitlementsRoute, /clearAppleSubscriptionOnProfile/);
assert.match(entitlementsRoute, /hasActiveSubscription/);

const types = read("lib/subscription/types.ts");
assert.match(types, /provider === "apple"/);
assert.match(types, /currentPeriodEnd/);
assert.match(types, /Fail closed/);

const products = read("lib/iap/products.ts");
assert.match(products, /com\.buxme\.pro\.monthly/);
assert.match(products, /com\.buxme\.proplus\.monthly/);
assert.doesNotMatch(products, /co\.buxme\.app\.pro/);

const envExample = read(".env.local.example");
assert.match(envExample, /APPLE_IAP_ISSUER_ID/);
assert.match(envExample, /APPLE_IAP_KEY_ID/);
assert.match(envExample, /APPLE_IAP_PRIVATE_KEY/);
assert.match(envExample, /APPLE_IAP_APP_APPLE_ID/);
assert.match(envExample, /api\/iap\/apple\/notifications/);

const envCatalog = read("scripts/lib/env-utils.mjs");
assert.match(envCatalog, /group: "Apple IAP"/);
assert.match(envCatalog, /APPLE_IAP_PRIVATE_KEY/);
assert.match(envCatalog, /REQUIRED when APPLE_IAP_ENVIRONMENT=Production/);

const docs = read("docs/IOS_APP_STORE.md");
assert.match(docs, /App Store Server Notifications/);
assert.match(docs, /APPLE_IAP_APP_APPLE_ID/);

const adminTypes = read("lib/admin/types.ts");
assert.match(adminTypes, /clear_apple_iap_binding/);
assert.match(adminTypes, /appleOriginalTransactionId/);

const entitlementAdmin = read("lib/admin/entitlementAdmin.ts");
assert.match(entitlementAdmin, /buildClearAppleIapBindingUpdate/);
assert.match(entitlementAdmin, /profileHasAppleIapBinding/);
assert.match(entitlementAdmin, /apple_original_transaction_id: null/);

const adminUserService = read("lib/admin/userService.ts");
assert.match(adminUserService, /clear_apple_iap_binding/);
assert.match(adminUserService, /buildClearAppleIapBindingUpdate/);
assert.match(adminUserService, /supportOnly: true/);
assert.match(adminUserService, /cleared Apple IAP binding/i);
assert.match(adminUserService, /apple_original_transaction_id\.eq/);
assert.match(adminUserService, /no stored Apple IAP binding to clear/);

const adminDashboard = read("components/admin/AdminDashboard.tsx");
assert.match(adminDashboard, /clear_apple_iap_binding/);
assert.match(adminDashboard, /Clear Apple IAP binding/);
assert.match(adminDashboard, /Apple OTID/);
assert.match(adminDashboard, /Does not delete the Auth user/);

const clearBindingScript = read("scripts/clear-apple-iap-binding.mjs");
assert.match(clearBindingScript, /clear_apple_iap_binding/);
assert.match(clearBindingScript, /apple_original_transaction_id/);
assert.match(clearBindingScript, /Does NOT delete Auth users/);
assert.match(clearBindingScript, /admin_event_logs/);
assert.match(clearBindingScript, /dry-run|dryRun/);

// Pure helper mirrors (keep in sync with entitlementAdmin.ts)
function profileHasAppleIapBinding(input) {
  return Boolean(
    input.appleOriginalTransactionId ||
      input.appleTransactionId ||
      input.appleProductId ||
      input.appleEnvironment ||
      input.subscriptionProvider === "apple",
  );
}

assert.equal(
  profileHasAppleIapBinding({
    appleOriginalTransactionId: "2000000123456789",
    appleTransactionId: null,
    appleProductId: null,
    appleEnvironment: null,
    subscriptionProvider: "none",
  }),
  true,
);
assert.equal(
  profileHasAppleIapBinding({
    appleOriginalTransactionId: null,
    appleTransactionId: null,
    appleProductId: null,
    appleEnvironment: null,
    subscriptionProvider: "none",
  }),
  false,
);
assert.equal(
  profileHasAppleIapBinding({
    appleOriginalTransactionId: null,
    appleTransactionId: null,
    appleProductId: null,
    appleEnvironment: null,
    subscriptionProvider: "apple",
  }),
  true,
);

const appleHealth = read("lib/iap/appleApiHealth.ts");
assert.match(appleHealth, /probeAppleApiAuth/);
assert.match(appleHealth, /inspectAppleCredentialFormats/);
assert.match(appleHealth, /getTransactionInfo/);
assert.doesNotMatch(appleHealth, /privateKey!/);

const appleHealthRoute = read("app/api/iap/apple/health/route.ts");
assert.match(appleHealthRoute, /getAppleIapHealthReport/);

const launchHealth = read("app/api/health/launch/route.ts");
assert.match(launchHealth, /appleIapConfigured/);

assert.match(docs, /appAccountToken/);
assert.match(docs, /legacy/i);

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

assert.ok(
  fs.existsSync(
    path.join(
      root,
      "scripts/fixtures/apple-app-store-server-library/certs/testCA.der",
    ),
  ),
);

const pkg = JSON.parse(read("package.json"));
assert.ok(pkg.dependencies["@apple/app-store-server-library"]);
assert.equal(pkg.scripts["test:apple-iap"], "node scripts/test-apple-iap.mjs");
assert.equal(
  pkg.scripts["test:apple-iap-crypto"],
  "node scripts/test-apple-iap-crypto.mjs",
);

// Confirm library is importable
const appleLib = require("@apple/app-store-server-library");
assert.ok(appleLib.SignedDataVerifier);
assert.ok(appleLib.AppStoreServerAPIClient);
assert.ok(appleLib.NotificationTypeV2);

console.log("✅ Apple IAP verification / ASN / entitlement checks passed.");
