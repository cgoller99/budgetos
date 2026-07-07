#!/usr/bin/env node
/**
 * Validates that all Buxme environment variables are present.
 *
 * Usage:
 *   npm run verify:env
 *   node scripts/verify-env.mjs
 */

import fs from "node:fs";
import {
  ENV_PATH,
  classifyEnvValue,
  getEnv,
  getRequiredVarNames,
  hydrateProcessEnvFromFile,
  parseEnvFile,
} from "./lib/env-utils.mjs";

hydrateProcessEnvFromFile();

const REQUIRED = getRequiredVarNames();
const issues = [];

console.log("Buxme environment variable check\n");

if (!fs.existsSync(ENV_PATH)) {
  console.error("✗ .env.local is missing");
  console.error("  Fix: cp .env.local.example .env.local");
  console.error("  Then: npm run env:pull");
  process.exit(1);
}

const map = parseEnvFile(ENV_PATH);
console.log(`✓ .env.local exists (${map.size} keys parsed)\n`);

for (const name of REQUIRED) {
  const raw = map.has(name) ? map.get(name) : undefined;
  const status = classifyEnvValue(raw);

  if (status === "ok") {
    console.log(`✓ ${name}`);
    continue;
  }

  if (status === "empty") {
    issues.push(`${name} is empty`);
    console.error(`✗ ${name} is empty (key in .env.local but no value — check Vercel Production)`);
    continue;
  }

  if (status === "placeholder") {
    issues.push(`${name} is a placeholder`);
    console.error(`✗ ${name} is still a placeholder`);
    continue;
  }

  issues.push(`${name} is missing`);
  console.error(`✗ ${name} is missing`);
}

const plaidEnv = getEnv("PLAID_ENV");
if (plaidEnv !== "production") {
  issues.push("PLAID_ENV must be production");
  console.error(`✗ PLAID_ENV must be production (current: ${plaidEnv || "unset"})`);
}

const webhookUrl = getEnv("PLAID_WEBHOOK_URL");
if (webhookUrl !== "https://buxme.co/api/plaid/webhook") {
  issues.push("PLAID_WEBHOOK_URL must be https://buxme.co/api/plaid/webhook");
  console.error("✗ PLAID_WEBHOOK_URL must be https://buxme.co/api/plaid/webhook");
}

const stripeSecret = getEnv("STRIPE_SECRET_KEY");
if (stripeSecret && !stripeSecret.startsWith("sk_live_")) {
  issues.push("STRIPE_SECRET_KEY must be a live key (sk_live_)");
  console.error("✗ STRIPE_SECRET_KEY must start with sk_live_ for production");
}

const stripePublishable = getEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
if (stripePublishable && !stripePublishable.startsWith("pk_live_")) {
  issues.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must be a live key (pk_live_)");
  console.error("✗ NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must start with pk_live_");
}

const encryptionKey = getEnv("PLAID_TOKEN_ENCRYPTION_KEY");
if (encryptionKey && encryptionKey.length < 32) {
  issues.push("PLAID_TOKEN_ENCRYPTION_KEY must be at least 32 characters");
  console.error("✗ PLAID_TOKEN_ENCRYPTION_KEY must be at least 32 characters");
}

console.log("");
if (issues.length > 0) {
  console.error(`❌ ${issues.length} environment issue(s) found.`);
  console.error("\nRun: npm run audit:env   (full checklist + diagnosis)");
  console.error("Run: npm run env:pull    (pull from Vercel without wiping secrets)");
  process.exit(1);
}

console.log("✅ All required environment variables are present.");
