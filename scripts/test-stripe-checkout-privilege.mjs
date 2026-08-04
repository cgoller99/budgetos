#!/usr/bin/env node
/**
 * Static check: Stripe customer persistence must use service role so the
 * profile privilege guard does not block checkout.
 *
 * Usage: npm run test:stripe-checkout-privilege
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const service = fs.readFileSync(
  path.join(ROOT, "lib/stripe/subscriptionService.ts"),
  "utf8",
);

const fnMatch = service.match(
  /export async function getOrCreateStripeCustomer[\s\S]*?\nexport async function createCheckoutSession/,
);

assert.ok(fnMatch, "getOrCreateStripeCustomer must exist");

const fn = fnMatch[0];

assert.match(
  fn,
  /createSupabaseAdminClient\(\)/,
  "getOrCreateStripeCustomer must persist stripe_customer_id with the service-role client",
);

assert.doesNotMatch(
  fn,
  /input\.supabase\s*\n?\s*\.from\("profiles"\)\s*\n?\s*\.update\(\s*\{[\s\S]*stripe_customer_id/,
  "getOrCreateStripeCustomer must not update stripe_customer_id via the user-scoped client",
);

console.log("✅ Stripe checkout privilege-guard wiring checks passed.");
