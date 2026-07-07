#!/usr/bin/env node
/**
 * Verifies Stripe Live Mode configuration.
 *
 * Usage:
 *   npm run verify:stripe
 */

import fs from "node:fs";
import path from "node:path";
import Stripe from "stripe";

const ENV_PATH = path.join(path.resolve(import.meta.dirname, ".."), ".env.local");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[trimmed.slice(0, index).trim()] = value;
  }
  return values;
}

function getEnv(name) {
  return process.env[name]?.trim() || loadEnvFile(ENV_PATH)[name]?.trim() || "";
}

const issues = [];

function fail(message) {
  issues.push(message);
  console.error(`✗ ${message}`);
}

function pass(message) {
  console.log(`✓ ${message}`);
}

console.log("Buxme Stripe Live Mode verification\n");

const secretKey = getEnv("STRIPE_SECRET_KEY");
const webhookSecret = getEnv("STRIPE_WEBHOOK_SECRET");
const proPriceId = getEnv("STRIPE_PRO_PRICE_ID");
const proPlusPriceId = getEnv("STRIPE_PRO_PLUS_PRICE_ID");
const publishableKey = getEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");

if (!secretKey) fail("STRIPE_SECRET_KEY is missing");
else if (!secretKey.startsWith("sk_live_")) fail("STRIPE_SECRET_KEY must be sk_live_ for production");
else pass("STRIPE_SECRET_KEY is a live key");

if (!webhookSecret) fail("STRIPE_WEBHOOK_SECRET is missing");
else if (!webhookSecret.startsWith("whsec_")) fail("STRIPE_WEBHOOK_SECRET looks invalid");
else pass("STRIPE_WEBHOOK_SECRET is set");

if (!publishableKey) fail("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing");
else if (!publishableKey.startsWith("pk_live_")) fail("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be pk_live_");
else pass("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is a live key");

if (!proPriceId?.startsWith("price_")) fail("STRIPE_PRO_PRICE_ID is missing or invalid");
else pass("STRIPE_PRO_PRICE_ID is set");

if (!proPlusPriceId?.startsWith("price_")) fail("STRIPE_PRO_PLUS_PRICE_ID is missing or invalid");
else pass("STRIPE_PRO_PLUS_PRICE_ID is set");

if (getEnv("NEXT_PUBLIC_STRIPE_ENABLED") !== "true") fail("NEXT_PUBLIC_STRIPE_ENABLED must be true");
else pass("NEXT_PUBLIC_STRIPE_ENABLED=true");

if (secretKey?.startsWith("sk_live_")) {
  const stripe = new Stripe(secretKey);

  try {
    const proPrice = await stripe.prices.retrieve(proPriceId);
    pass(`Pro price active: ${proPrice.id} (${proPrice.unit_amount ? proPrice.unit_amount / 100 : "?"} ${proPrice.currency})`);
  } catch (error) {
    fail(`Pro price invalid: ${error instanceof Error ? error.message : "unknown"}`);
  }

  try {
    const proPlusPrice = await stripe.prices.retrieve(proPlusPriceId);
    pass(`Pro+ price active: ${proPlusPrice.id} (${proPlusPrice.unit_amount ? proPlusPrice.unit_amount / 100 : "?"} ${proPlusPrice.currency})`);
  } catch (error) {
    fail(`Pro+ price invalid: ${error instanceof Error ? error.message : "unknown"}`);
  }
}

console.log("");
if (issues.length > 0) {
  console.error(`❌ Stripe verification failed (${issues.length} issue(s)).`);
  process.exit(1);
}

console.log("✅ Stripe Live Mode verification passed.");
