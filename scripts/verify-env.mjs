#!/usr/bin/env node
/**
 * Validates that all Buxme environment variables are present.
 *
 * Usage:
 *   npm run verify:env
 *   node scripts/verify-env.mjs
 *   node scripts/verify-env.mjs --warn-local-secrets
 */

import fs from "node:fs";
import {
  ENV_PATH,
  classifyEnvValue,
  getEnv,
  getRequiredVarNames,
  getSecretVarNames,
  hydrateProcessEnvFromFile,
  isSecretVar,
  parseEnvFile,
} from "./lib/env-utils.mjs";

const args = process.argv.slice(2);
const warnLocalSecrets = args.includes("--warn-local-secrets");

hydrateProcessEnvFromFile();

const REQUIRED = getRequiredVarNames();
const SECRET_VARS = new Set(getSecretVarNames());
const issues = [];
const warnings = [];

function warn(message) {
  warnings.push(message);
  console.warn(`⚠ ${message}`);
}

function fail(message) {
  issues.push(message);
  console.error(`✗ ${message}`);
}

function shouldWarnForVar(name, status) {
  if (!warnLocalSecrets) {
    return false;
  }

  if (SECRET_VARS.has(name) && (status === "empty" || status === "absent" || status === "placeholder")) {
    return true;
  }

  if (
    warnLocalSecrets &&
    (name === "PLAID_ENV" || name === "PLAID_WEBHOOK_URL") &&
    (status === "empty" || status === "absent" || status === "placeholder")
  ) {
    return true;
  }

  return false;
}

console.log("Buxme environment variable check\n");

if (warnLocalSecrets) {
  console.log("Mode: production runtime is healthy — missing local secrets are warnings only.\n");
}

if (!fs.existsSync(ENV_PATH)) {
  const message = ".env.local is missing";
  if (warnLocalSecrets) {
    warn(`${message} (copy secrets from provider dashboards when needed for local dev)`);
  } else {
    fail(message);
    console.error("  Fix: cp .env.local.example .env.local");
    console.error("  Then copy values from each provider dashboard (not vercel env pull for secrets).");
    process.exit(1);
  }
} else {
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
      const message = `${name} is empty (key in .env.local but no value)`;
      if (shouldWarnForVar(name, status)) {
        warn(`${message} — Vercel sensitive Production secrets cannot be exported via env pull`);
      } else {
        fail(message);
      }
      continue;
    }

    if (status === "placeholder") {
      const message = `${name} is still a placeholder`;
      if (shouldWarnForVar(name, status)) {
        warn(message);
      } else {
        fail(message);
      }
      continue;
    }

    const message = `${name} is missing`;
    if (shouldWarnForVar(name, status)) {
      warn(`${message} — copy from provider dashboard when needed for local dev`);
    } else {
      fail(message);
    }
  }
}

const plaidEnv = getEnv("PLAID_ENV");
if (plaidEnv !== "production") {
  const message = `PLAID_ENV must be production (current: ${plaidEnv || "unset"})`;
  if (warnLocalSecrets) {
    warn(message);
  } else {
    fail(message);
  }
}

const webhookUrl = getEnv("PLAID_WEBHOOK_URL");
if (webhookUrl !== "https://buxme.co/api/plaid/webhook") {
  const message = "PLAID_WEBHOOK_URL must be https://buxme.co/api/plaid/webhook";
  if (warnLocalSecrets) {
    warn(message);
  } else {
    fail(message);
  }
}

const stripeSecret = getEnv("STRIPE_SECRET_KEY");
if (stripeSecret && !stripeSecret.startsWith("sk_live_")) {
  fail("STRIPE_SECRET_KEY must start with sk_live_ for production");
}

const stripePublishable = getEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
if (stripePublishable && !stripePublishable.startsWith("pk_live_")) {
  fail("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must start with pk_live_");
}

const encryptionKey = getEnv("PLAID_TOKEN_ENCRYPTION_KEY");
if (encryptionKey && encryptionKey.length < 32) {
  if (warnLocalSecrets && isSecretVar("PLAID_TOKEN_ENCRYPTION_KEY")) {
    warn("PLAID_TOKEN_ENCRYPTION_KEY must be at least 32 characters");
  } else {
    fail("PLAID_TOKEN_ENCRYPTION_KEY must be at least 32 characters");
  }
}

console.log("");
if (warnings.length > 0) {
  console.warn(`⚠ ${warnings.length} local environment warning(s) (non-blocking).`);
  console.warn("  Production runtime is authoritative; copy secrets from provider dashboards for local dev.");
}

if (issues.length > 0) {
  console.error(`❌ ${issues.length} environment issue(s) found.`);
  console.error("\nRun: npm run audit:env   (full checklist + diagnosis)");
  process.exit(1);
}

if (warnings.length > 0) {
  console.log("✅ Local environment check passed with warnings.");
} else {
  console.log("✅ All required environment variables are present.");
}
