#!/usr/bin/env node
/**
 * Verifies Buxme Plaid Production configuration and webhook reachability.
 *
 * Usage:
 *   npm run verify:plaid
 *   npm run verify:plaid -- --url https://buxme.co/api/plaid/webhook
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");
const PRODUCTION_WEBHOOK_URL = "https://buxme.co/api/plaid/webhook";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values = {};

  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");

    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function getEnv(name) {
  return process.env[name]?.trim() || loadEnvFile(ENV_PATH)[name]?.trim() || "";
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`✓ ${message}`);
}

function warn(message) {
  console.warn(`! ${message}`);
}

async function checkWebhookReachability(url) {
  const response = await fetch(url, { method: "GET" });

  if (response.status !== 200) {
    fail(`Webhook health check returned HTTP ${response.status} for ${url}`);
    return;
  }

  const body = await response.json().catch(() => null);

  if (!body?.ok) {
    fail(`Webhook health check response missing ok=true for ${url}`);
    return;
  }

  pass(`Webhook endpoint reachable at ${url} (HTTP 200)`);

  if (body.environment) {
    pass(`Remote Plaid environment: ${body.environment}`);
  }

  if (body.webhookUrl && body.webhookUrl !== PRODUCTION_WEBHOOK_URL) {
    warn(`Remote webhook URL is ${body.webhookUrl}, expected ${PRODUCTION_WEBHOOK_URL}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const urlFlagIndex = args.indexOf("--url");
  const webhookUrl =
    (urlFlagIndex >= 0 ? args[urlFlagIndex + 1] : "") ||
    getEnv("PLAID_WEBHOOK_URL") ||
    PRODUCTION_WEBHOOK_URL;

  console.log("Buxme Plaid Production verification\n");

  const required = [
    "PLAID_CLIENT_ID",
    "PLAID_SECRET",
    "PLAID_TOKEN_ENCRYPTION_KEY",
    "PLAID_WEBHOOK_URL",
  ];

  let envOk = true;

  for (const key of required) {
    const value = getEnv(key);

    if (!value) {
      envOk = false;
      fail(`${key} is missing`);
      continue;
    }

    pass(`${key} is set`);
  }

  const plaidEnv = (getEnv("PLAID_ENV") || "production").toLowerCase();

  if (plaidEnv !== "production") {
    envOk = false;
    fail(`PLAID_ENV must be production (current: ${plaidEnv || "unset"})`);
  } else {
    pass("PLAID_ENV=production");
  }

  const configuredWebhookUrl = getEnv("PLAID_WEBHOOK_URL") || PRODUCTION_WEBHOOK_URL;

  if (configuredWebhookUrl !== PRODUCTION_WEBHOOK_URL) {
    envOk = false;
    fail(`PLAID_WEBHOOK_URL must be ${PRODUCTION_WEBHOOK_URL}`);
  } else {
    pass(`PLAID_WEBHOOK_URL=${PRODUCTION_WEBHOOK_URL}`);
  }

  if (getEnv("NEXT_PUBLIC_PLAID_ENABLED") !== "true") {
    warn("NEXT_PUBLIC_PLAID_ENABLED is not true");
  } else {
    pass("NEXT_PUBLIC_PLAID_ENABLED=true");
  }

  if (getEnv("PLAID_TOKEN_ENCRYPTION_KEY").length < 32) {
    envOk = false;
    fail("PLAID_TOKEN_ENCRYPTION_KEY must be at least 32 characters");
  }

  console.log("");

  try {
    await checkWebhookReachability(webhookUrl);
  } catch (error) {
    fail(
      `Unable to reach webhook endpoint (${webhookUrl}): ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    );
  }

  console.log("");

  if (process.exitCode) {
    console.error("Plaid production verification failed.");
    process.exit(process.exitCode);
  }

  if (!envOk) {
    console.error("Environment checks failed. Fix .env.local / Vercel env vars before going live.");
    process.exit(1);
  }

  console.log("Plaid production verification passed.");
}

main();
