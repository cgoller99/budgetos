#!/usr/bin/env node
/**
 * Validates that all Buxme environment variables are present.
 *
 * Usage:
 *   npm run verify:env
 *   node --env-file=.env.local scripts/verify-env.mjs
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SITE_URL",
  "PLAID_CLIENT_ID",
  "PLAID_SECRET",
  "PLAID_ENV",
  "PLAID_TOKEN_ENCRYPTION_KEY",
  "PLAID_WEBHOOK_URL",
  "NEXT_PUBLIC_PLAID_ENABLED",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRO_PRICE_ID",
  "STRIPE_PRO_PLUS_PRICE_ID",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_STRIPE_ENABLED",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "CRON_SECRET",
  "ADMIN_EMAILS",
  "FOUNDER_EMAILS",
  "NEXT_PUBLIC_POSTHOG_KEY",
];

const PLACEHOLDER = [/^your-/i, /xxxx/i, /^change-me$/i, /^YOUR-/];

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

console.log("Buxme environment variable check\n");

if (!fs.existsSync(ENV_PATH)) {
  console.error("✗ .env.local is missing");
  console.error("  Fix: cp .env.local.example .env.local");
  console.error("  Then: vercel env pull .env.local --environment=production");
  process.exit(1);
}

console.log("✓ .env.local exists\n");

for (const name of REQUIRED) {
  const value = getEnv(name);
  if (!value) {
    issues.push(`${name} is missing`);
    console.error(`✗ ${name} is missing`);
    continue;
  }
  if (PLACEHOLDER.some((pattern) => pattern.test(value))) {
    issues.push(`${name} is a placeholder`);
    console.error(`✗ ${name} is still a placeholder`);
    continue;
  }
  console.log(`✓ ${name}`);
}

if (getEnv("PLAID_ENV") !== "production") {
  issues.push("PLAID_ENV must be production");
  console.error(`✗ PLAID_ENV must be production (current: ${getEnv("PLAID_ENV") || "unset"})`);
}

if (getEnv("PLAID_WEBHOOK_URL") !== "https://buxme.co/api/plaid/webhook") {
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

if (getEnv("PLAID_TOKEN_ENCRYPTION_KEY").length > 0 && getEnv("PLAID_TOKEN_ENCRYPTION_KEY").length < 32) {
  issues.push("PLAID_TOKEN_ENCRYPTION_KEY must be at least 32 characters");
  console.error("✗ PLAID_TOKEN_ENCRYPTION_KEY must be at least 32 characters");
}

console.log("");
if (issues.length > 0) {
  console.error(`❌ ${issues.length} environment issue(s) found.`);
  console.error("\nFix: vercel env pull .env.local --environment=production");
  process.exit(1);
}

console.log("✅ All required environment variables are present.");
