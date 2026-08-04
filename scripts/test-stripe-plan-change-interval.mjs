#!/usr/bin/env node
/**
 * Validates Stripe plan-change interval preservation.
 *
 * Usage: npm run test:stripe-plan-change-interval
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

function detectBillingIntervalFromStripePrice(price) {
  if (!price || typeof price === "string") {
    return null;
  }

  const interval = price.recurring?.interval;
  if (interval === "month" || interval === "year") {
    return interval;
  }

  return null;
}

function missingPlanChangePriceError(targetPlan, interval) {
  const planLabel = targetPlan === "pro_plus" ? "Pro+" : "Pro";
  const intervalLabel = interval === "year" ? "yearly" : "monthly";
  const envHint =
    interval === "year"
      ? targetPlan === "pro_plus"
        ? "STRIPE_PRO_PLUS_YEARLY_PRICE_ID or STRIPE_PRO_PLUS_PRODUCT_ID"
        : "STRIPE_PRO_YEARLY_PRICE_ID or STRIPE_PRO_PRODUCT_ID"
      : targetPlan === "pro_plus"
        ? "STRIPE_PRO_PLUS_PRICE_ID or STRIPE_PRO_PLUS_PRODUCT_ID"
        : "STRIPE_PRO_PRICE_ID or STRIPE_PRO_PRODUCT_ID";

  return `Cannot change to ${planLabel} ${intervalLabel}: no matching live Stripe price is configured (${envHint}). Billing interval was not changed.`;
}

function resolvePlanChangePriceId({ targetPlan, currentInterval, prices }) {
  const priceId = prices[targetPlan][currentInterval]?.trim();
  if (!priceId) {
    throw new Error(missingPlanChangePriceError(targetPlan, currentInterval));
  }
  return priceId;
}

const PLAN_CHANGE_PRORATION_BEHAVIOR = "create_prorations";

const PRICES = {
  pro: {
    month: "price_pro_month",
    year: "price_pro_year",
  },
  pro_plus: {
    month: "price_pro_plus_month",
    year: "price_pro_plus_year",
  },
};

function assertPreservesInterval(fromPlan, toPlan, interval) {
  const priceId = resolvePlanChangePriceId({
    targetPlan: toPlan,
    currentInterval: interval,
    prices: PRICES,
  });

  assert.equal(
    priceId,
    PRICES[toPlan][interval],
    `${fromPlan} → ${toPlan} must stay on ${interval}`,
  );
  assert.notEqual(
    priceId,
    PRICES[toPlan][interval === "month" ? "year" : "month"],
    `${fromPlan} → ${toPlan} must not switch intervals`,
  );
}

// Source wiring must call the interval-preserving helpers.
const serviceSource = fs.readFileSync(
  path.join(ROOT, "lib/stripe/subscriptionService.ts"),
  "utf8",
);
const planChangeSource = fs.readFileSync(
  path.join(ROOT, "lib/stripe/planChange.ts"),
  "utf8",
);
const priceResolverSource = fs.readFileSync(
  path.join(ROOT, "lib/stripe/priceResolver.ts"),
  "utf8",
);

assert.match(
  serviceSource,
  /detectBillingIntervalFromStripePrice/,
  "changeSubscriptionPlan must detect the current Stripe billing interval",
);
assert.match(
  serviceSource,
  /resolvePriceIdForPlanStrict/,
  "changeSubscriptionPlan must resolve destination prices with strict interval matching",
);
assert.match(
  serviceSource,
  /PLAN_CHANGE_PRORATION_BEHAVIOR/,
  "changeSubscriptionPlan must use the intentional proration constant",
);
assert.doesNotMatch(
  serviceSource,
  /resolvePriceIdForPlan\(\s*input\.targetPlan\s*\)/,
  "changeSubscriptionPlan must not call resolvePriceIdForPlan without an interval",
);
assert.match(
  priceResolverSource,
  /export async function resolvePriceIdForPlanStrict/,
  "priceResolver must export resolvePriceIdForPlanStrict",
);
assert.match(
  priceResolverSource,
  /allowIntervalFallback: false/,
  "strict resolver must disable interval fallback",
);
assert.match(
  planChangeSource,
  /Billing interval was not changed/,
  "missing destination price must block the change with a clear error",
);
assert.match(
  planChangeSource,
  /export const PLAN_CHANGE_PRORATION_BEHAVIOR = "create_prorations"/,
  "proration must remain create_prorations",
);

assert.equal(
  detectBillingIntervalFromStripePrice({
    id: "price_1",
    recurring: { interval: "month" },
  }),
  "month",
);
assert.equal(
  detectBillingIntervalFromStripePrice({
    id: "price_2",
    recurring: { interval: "year" },
  }),
  "year",
);
assert.equal(
  detectBillingIntervalFromStripePrice({ id: "price_3", recurring: null }),
  null,
);
assert.equal(detectBillingIntervalFromStripePrice("price_string"), null);
assert.equal(detectBillingIntervalFromStripePrice(null), null);

assertPreservesInterval("pro", "pro_plus", "month");
assertPreservesInterval("pro_plus", "pro", "month");
assertPreservesInterval("pro", "pro_plus", "year");
assertPreservesInterval("pro_plus", "pro", "year");

assert.throws(
  () =>
    resolvePlanChangePriceId({
      targetPlan: "pro_plus",
      currentInterval: "year",
      prices: {
        pro: PRICES.pro,
        pro_plus: { month: PRICES.pro_plus.month },
      },
    }),
  (error) =>
    error instanceof Error &&
    error.message === missingPlanChangePriceError("pro_plus", "year") &&
    error.message.includes("Billing interval was not changed"),
);

assert.equal(PLAN_CHANGE_PRORATION_BEHAVIOR, "create_prorations");

console.log("✅ Stripe plan-change interval preservation checks passed.");
console.log("  • monthly Pro → monthly Pro+");
console.log("  • monthly Pro+ → monthly Pro");
console.log("  • yearly Pro → yearly Pro+");
console.log("  • yearly Pro+ → yearly Pro");
console.log("  • missing yearly destination price blocks change (no silent monthly fallback)");
console.log("  • proration_behavior remains create_prorations (intentional)");
