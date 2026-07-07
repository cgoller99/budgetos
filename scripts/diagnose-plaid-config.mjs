#!/usr/bin/env node
/**
 * Diagnose Plaid configuration without exposing secret values.
 *
 * Usage:
 *   npm run diagnose:plaid
 *   node scripts/diagnose-plaid-config.mjs
 */

import { hydrateProcessEnvFromFile } from "./lib/env-utils.mjs";

hydrateProcessEnvFromFile();

const PLAID_PRODUCTION_WEBHOOK_URL = "https://buxme.co/api/plaid/webhook";

function normalizePlaidWebhookUrl(value) {
  if (!value) return undefined;
  let normalized = value.trim();
  const urlPrefixMatch = normalized.match(/^URL=(.+)$/i);
  if (urlPrefixMatch) normalized = urlPrefixMatch[1].trim();
  return normalized;
}

function status(name) {
  const raw = process.env[name];
  if (raw === undefined) return "missing";
  if (raw.trim() === "") return "empty";
  return "present";
}

function resolveEffectiveWebhookUrl(webhookUrl, environment) {
  if (webhookUrl) return webhookUrl;
  if (environment === "production") return PLAID_PRODUCTION_WEBHOOK_URL;
  return undefined;
}

function getConfigurationError() {
  const clientId = process.env.PLAID_CLIENT_ID?.trim();
  const secret = process.env.PLAID_SECRET?.trim();
  const environment = (process.env.PLAID_ENV?.trim().toLowerCase() || "production");
  const tokenEncryptionKey = process.env.PLAID_TOKEN_ENCRYPTION_KEY?.trim();
  const rawWebhookUrl = normalizePlaidWebhookUrl(process.env.PLAID_WEBHOOK_URL);
  const effectiveWebhookUrl = resolveEffectiveWebhookUrl(rawWebhookUrl, environment);

  if (process.env.VERCEL_ENV === "production" && environment === "sandbox") {
    return "PLAID_ENV cannot be sandbox in production";
  }
  if (environment === "production" && effectiveWebhookUrl !== PLAID_PRODUCTION_WEBHOOK_URL) {
    return `PLAID_WEBHOOK_URL must be ${PLAID_PRODUCTION_WEBHOOK_URL} (effective: ${effectiveWebhookUrl ?? "unset"})`;
  }
  if (!clientId) return "PLAID_CLIENT_ID is missing";
  if (!secret) return "PLAID_SECRET is missing";
  if (!tokenEncryptionKey) return "PLAID_TOKEN_ENCRYPTION_KEY is missing";
  if (tokenEncryptionKey.length < 32) return "PLAID_TOKEN_ENCRYPTION_KEY must be at least 32 characters";
  return null;
}

const vars = [
  "PLAID_CLIENT_ID",
  "PLAID_SECRET",
  "PLAID_ENV",
  "PLAID_TOKEN_ENCRYPTION_KEY",
  "PLAID_WEBHOOK_URL",
];

console.log("Plaid configuration diagnostic\n");

for (const name of vars) {
  console.log(`  ${name}: ${status(name)}`);
}

const rawWebhook = process.env.PLAID_WEBHOOK_URL?.trim();
const normalizedWebhook = normalizePlaidWebhookUrl(process.env.PLAID_WEBHOOK_URL);

if (rawWebhook && rawWebhook !== normalizedWebhook) {
  console.log("\n⚠ PLAID_WEBHOOK_URL is malformed in the environment.");
  console.log(`  Raw value starts with: ${rawWebhook.slice(0, 40)}...`);
  console.log(`  Normalized to: ${normalizedWebhook}`);
  console.log("  Fix in Vercel: set PLAID_WEBHOOK_URL=https://buxme.co/api/plaid/webhook");
}

const error = getConfigurationError();
console.log("");
if (error) {
  console.error(`configured: false`);
  console.error(`reason: ${error}`);
  process.exit(1);
}

console.log("configured: true");
