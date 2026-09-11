#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  STORE_CATALOG_RETRY_DELAYS_MS,
  evaluateStoreCatalog,
  shouldRetryStoreCatalog,
} from "../lib/iap/storeCatalogPolicy.ts";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const pro = {
  productId: "com.buxme.pro.monthly",
  plan: "pro",
};
const proPlus = {
  productId: "com.buxme.proplus.monthly",
  plan: "pro_plus",
};

const expectedIds = ["com.buxme.pro.monthly", "com.buxme.proplus.monthly"];
assert.equal(evaluateStoreCatalog([pro, proPlus], expectedIds).status, "ready");
assert.equal(evaluateStoreCatalog([pro], expectedIds).status, "partial");
assert.equal(evaluateStoreCatalog([], expectedIds).status, "empty");
assert.deepEqual(evaluateStoreCatalog([pro], expectedIds).missingProductIds, [
  "com.buxme.proplus.monthly",
]);

assert.equal(STORE_CATALOG_RETRY_DELAYS_MS.length, 4);
assert.equal(shouldRetryStoreCatalog("empty", 0), true);
assert.equal(shouldRetryStoreCatalog("partial", 1), true);
assert.equal(shouldRetryStoreCatalog("error", 2), true);
assert.equal(shouldRetryStoreCatalog("empty", 3), false);
assert.equal(shouldRetryStoreCatalog("ready", 0), false);

let attempt = 0;
let state = "empty";
const simulatedResponses = [[], [pro, proPlus]];
while (true) {
  const evaluation = evaluateStoreCatalog(
    simulatedResponses[attempt] ?? [],
    expectedIds,
  );
  state = evaluation.status;
  if (!shouldRetryStoreCatalog(state, attempt)) break;
  attempt += 1;
}
assert.equal(attempt, 1, "temporary zero-products result must retry");
assert.equal(state, "ready", "retry must recover when StoreKit later returns products");

const products = read("lib/iap/products.ts");
assert.match(products, /com\.buxme\.pro\.monthly/);
assert.match(products, /com\.buxme\.proplus\.monthly/);
assert.match(products, /subscriptionTitle: "Buxme Pro"/);
assert.match(products, /subscriptionTitle: "Buxme Pro\+"/);
assert.match(products, /durationLabel: "1 month"/);
assert.match(products, /usPriceLabel: "\$7\.99\/month"/);
assert.match(products, /usPriceLabel: "\$14\.99\/month"/);
assert.ok(products.includes("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"));
assert.ok(products.includes("https://buxme.co/privacy"));
const terms = read("app/terms/page.tsx");
assert.ok(terms.includes("Apple’s App Store"));
assert.ok(terms.includes("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"));

const billing = read("components/settings/BillingSection.tsx");
for (const contract of [
  "Buxme Pro and Buxme Pro+ each renew every 1 month unless canceled.",
  "Terms of Use (Apple Standard EULA)",
  "Privacy Policy",
  "Retry App Store",
  "StoreKit diagnostics for App Review",
  'loadStoreCatalog("initial")',
  'loadStoreCatalog("manual")',
  'loadStoreCatalog("resume")',
  'loadStoreCatalog("online")',
  "STORE_CATALOG_RETRY_DELAYS_MS",
  "evaluateStoreCatalog",
  "indexStoreProductsByPlan",
  "discoveredProducts.set(product.plan, product)",
]) {
  assert.ok(billing.includes(contract), `missing App Review UI contract: ${contract}`);
}
assert.ok(billing.includes("!storeProducts[plan.id as IapPlan]"));
assert.ok(billing.includes("storeProduct.priceString"));
assert.ok(billing.includes("Loading App Store price"));
assert.ok(billing.includes("Price unavailable — retry App Store"));
assert.ok(billing.includes("Restore Purchases"));
assert.ok(billing.includes("Manage App Store subscription"));
assert.ok(billing.includes("purchaseAndVerifyNativePlan(plan, user.id)"));
assert.ok(billing.includes("/api/iap/apple/catalog-diagnostics"));

const nativePurchases = read("lib/iap/nativePurchases.ts");
const catalogStart = nativePurchases.indexOf("export async function getNativeStoreProducts");
const catalogEnd = nativePurchases.indexOf("export async function purchaseNativePlan");
const catalogSource = nativePurchases.slice(catalogStart, catalogEnd);
assert.ok(catalogSource.includes("NativePurchases.getProducts"));
assert.ok(catalogSource.includes("IAP_PRODUCT_IDS"));
assert.ok(catalogSource.includes("PURCHASE_TYPE.SUBS"));
assert.ok(catalogSource.includes("priceString"));
assert.ok(!catalogSource.includes("supabase"));
assert.ok(!catalogSource.includes("getUser"));
assert.ok(nativePurchases.includes("appAccountToken: authenticatedUserId"));
assert.ok(nativePurchases.includes("restoreNativePurchases"));
assert.ok(nativePurchases.includes("NativePurchases.restorePurchases()"));
assert.ok(nativePurchases.includes("onlyCurrentEntitlements: true"));

const diagnostics = read("lib/iap/storeKitDiagnostics.ts");
assert.ok(diagnostics.includes("NativePurchases.getStorefront()"));
assert.ok(diagnostics.includes("storefrontCountryCode"));
assert.ok(diagnostics.includes("storefrontId"));

const clientApi = read("lib/iap/clientApi.ts");
assert.ok(clientApi.includes("resolveFreshAuthenticatedUserId"));
assert.ok(clientApi.includes("supabase.auth.getUser()"));
assert.ok(clientApi.includes("appAccountTokenSent: freshUserId"));
assert.ok(clientApi.includes("restoreAndVerifyNativePurchases"));
assert.ok(clientApi.includes("verifyApplePurchase(preferred)"));

const project = read("ios/App/App.xcodeproj/project.pbxproj");
assert.ok(project.includes("com.apple.InAppPurchase"));
assert.ok(project.includes("enabled = 1"));
assert.ok(project.includes('TARGETED_DEVICE_FAMILY = "1,2"'));
assert.ok(project.includes("PRODUCT_BUNDLE_IDENTIFIER = co.buxme.app"));
const plist = read("ios/App/App/Info.plist");
assert.ok(plist.includes("UISupportedInterfaceOrientations~ipad"));

const diagnosticRoute = read("app/api/iap/apple/catalog-diagnostics/route.ts");
assert.ok(diagnosticRoute.includes("supabase.auth.getUser()"));
assert.ok(diagnosticRoute.includes("[iap/storekit-catalog] Native catalog unavailable"));
assert.ok(diagnosticRoute.includes("storefrontCountryCode"));
assert.ok(!diagnosticRoute.includes("appAccountToken"));
assert.ok(!diagnosticRoute.includes("signedTransaction"));
assert.ok(!diagnosticRoute.includes("privateKey"));

const health = read("lib/iap/appleApiHealth.ts");
assert.ok(health.includes("preferredApiAuthOk"));
assert.ok(health.includes("config.preferredEnvironment === Environment.SANDBOX"));
assert.ok(health.includes("credentialFormats.appAppleIdLooksNumeric"));
assert.ok(health.includes("ok: config.isConfigured && preferredApiAuthOk && formatOk"));

const pkg = JSON.parse(read("package.json"));
assert.equal(pkg.dependencies["@capgo/native-purchases"], "^8.7.0");
console.log("✅ App Store Build 13 rejection regression checks passed.");
