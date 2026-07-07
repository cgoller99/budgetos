#!/usr/bin/env node
/**
 * Buxme Plaid Production readiness audit.
 *
 * Usage:
 *   npm run verify:plaid
 *   npm run verify:plaid -- --url https://buxme.co/api/plaid/webhook
 *   npm run verify:plaid -- --skip-remote
 */

import fs from "node:fs";
import path from "node:path";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");
const PRODUCTION_WEBHOOK_URL = "https://buxme.co/api/plaid/webhook";

const PLACEHOLDER_PATTERNS = [
  /^your-/i,
  /^plaid_/i,
  /xxxx/i,
  /^change-me$/i,
];

const REQUIRED_IMPLEMENTATION_FILES = [
  "lib/plaid/config.ts",
  "lib/plaid/plaidClient.ts",
  "lib/plaid/plaidService.ts",
  "lib/plaid/syncService.ts",
  "lib/plaid/webhookVerification.ts",
  "lib/plaid/webhookProcessor.ts",
  "lib/plaid/mappers.ts",
  "lib/plaid/recurringDetectionService.ts",
  "app/api/plaid/webhook/route.ts",
  "app/api/plaid/link-token/route.ts",
  "app/api/plaid/exchange/route.ts",
  "app/api/plaid/sync/route.ts",
];

const issues = [];
const warnings = [];
const passed = [];

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

function isPlaceholder(value) {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

function recordPass(message) {
  passed.push(message);
  console.log(`✓ ${message}`);
}

function recordFail(message, checklistItem) {
  issues.push(checklistItem ?? message);
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function recordWarn(message, checklistItem) {
  warnings.push(checklistItem ?? message);
  console.warn(`! ${message}`);
}

function section(title) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
}

function checkRequiredEnv(name, { minLength } = {}) {
  const value = getEnv(name);

  if (!value) {
    recordFail(`${name} is missing`, `Set ${name} in .env.local and Vercel Production`);
    return null;
  }

  if (isPlaceholder(value)) {
    recordFail(`${name} is still a placeholder`, `Replace ${name} with your Plaid Production value`);
    return null;
  }

  if (minLength && value.length < minLength) {
    recordFail(
      `${name} must be at least ${minLength} characters`,
      `Generate a secure ${name} (${minLength}+ chars)`,
    );
    return null;
  }

  recordPass(`${name} is set`);
  return value;
}

function auditEnvironmentVariables() {
  section("1. Environment variables");

  checkRequiredEnv("PLAID_CLIENT_ID");
  checkRequiredEnv("PLAID_SECRET");
  checkRequiredEnv("PLAID_TOKEN_ENCRYPTION_KEY", { minLength: 32 });
  checkRequiredEnv("PLAID_WEBHOOK_URL");

  const plaidEnv = (getEnv("PLAID_ENV") || "production").toLowerCase();

  if (plaidEnv !== "production") {
    recordFail(
      `PLAID_ENV must be production (current: ${plaidEnv || "unset"})`,
      "Set PLAID_ENV=production in Vercel Production environment",
    );
  } else {
    recordPass("PLAID_ENV=production");
  }

  const webhookUrl = getEnv("PLAID_WEBHOOK_URL") || PRODUCTION_WEBHOOK_URL;

  if (webhookUrl !== PRODUCTION_WEBHOOK_URL) {
    recordFail(
      `PLAID_WEBHOOK_URL must be ${PRODUCTION_WEBHOOK_URL}`,
      `Set PLAID_WEBHOOK_URL=${PRODUCTION_WEBHOOK_URL}`,
    );
  } else {
    recordPass(`PLAID_WEBHOOK_URL=${PRODUCTION_WEBHOOK_URL}`);
  }

  if (getEnv("NEXT_PUBLIC_PLAID_ENABLED") !== "true") {
    recordWarn(
      "NEXT_PUBLIC_PLAID_ENABLED is not true",
      "Set NEXT_PUBLIC_PLAID_ENABLED=true to show bank linking in the app",
    );
  } else {
    recordPass("NEXT_PUBLIC_PLAID_ENABLED=true");
  }

  if (!getEnv("SUPABASE_SERVICE_ROLE_KEY")) {
    recordFail(
      "SUPABASE_SERVICE_ROLE_KEY is missing",
      "Set SUPABASE_SERVICE_ROLE_KEY (required for Plaid webhook processing)",
    );
  } else {
    recordPass("SUPABASE_SERVICE_ROLE_KEY is set");
  }

  if (!getEnv("NEXT_PUBLIC_SUPABASE_URL") || !getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
    recordWarn(
      "Supabase public env vars are incomplete",
      "Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set",
    );
  } else {
    recordPass("Supabase public env vars are set");
  }
}

function auditImplementation() {
  section("2. Code implementation");

  for (const relativePath of REQUIRED_IMPLEMENTATION_FILES) {
    const absolutePath = path.join(ROOT, relativePath);

    if (!fs.existsSync(absolutePath)) {
      recordFail(`Missing required file: ${relativePath}`);
      continue;
    }

    recordPass(`Found ${relativePath}`);
  }

  const webhookRoute = fs.readFileSync(
    path.join(ROOT, "app/api/plaid/webhook/route.ts"),
    "utf8",
  );
  const verificationModule = fs.readFileSync(
    path.join(ROOT, "lib/plaid/webhookVerification.ts"),
    "utf8",
  );
  const syncService = fs.readFileSync(path.join(ROOT, "lib/plaid/syncService.ts"), "utf8");
  const plaidService = fs.readFileSync(path.join(ROOT, "lib/plaid/plaidService.ts"), "utf8");
  const plaidClient = fs.readFileSync(path.join(ROOT, "lib/plaid/plaidClient.ts"), "utf8");
  const configModule = fs.readFileSync(path.join(ROOT, "lib/plaid/config.ts"), "utf8");

  if (webhookRoute.includes("export async function GET")) {
    recordPass("Webhook route exposes GET health check");
  } else {
    recordFail("Webhook route missing GET health check");
  }

  if (webhookRoute.includes("verifyPlaidWebhook")) {
    recordPass("Webhook route validates Plaid-Verification signatures");
  } else {
    recordFail("Webhook route does not call verifyPlaidWebhook");
  }

  if (verificationModule.includes("jwtVerify") && verificationModule.includes("request_body_sha256")) {
    recordPass("Webhook verification checks JWT signature and body SHA-256 hash");
  } else {
    recordFail("Webhook verification module is incomplete");
  }

  if (plaidService.includes("resolvePlaidWebhookUrl")) {
    recordPass("Link token creation attaches production webhook URL");
  } else {
    recordFail("Link token creation does not resolve production webhook URL");
  }

  if (plaidClient.includes("PlaidEnvironments.production")) {
    recordPass("Plaid client supports production API base path");
  } else {
    recordFail("Plaid client missing production environment mapping");
  }

  if (configModule.includes('return "production"')) {
    recordPass("PLAID_ENV defaults to production when unset");
  } else {
    recordWarn("PLAID_ENV may not default to production");
  }

  if (syncService.includes("accountsGet") && syncService.includes("upsertLinkedAccounts")) {
    recordPass("Account sync implemented (accountsGet → upsertLinkedAccounts)");
  } else {
    recordFail("Account sync pipeline incomplete");
  }

  if (syncService.includes("transactionsSync") && syncService.includes("persistSyncedTransactions")) {
    recordPass("Transaction sync implemented (transactionsSync → persistSyncedTransactions)");
  } else {
    recordFail("Transaction sync pipeline incomplete");
  }

  if (syncService.includes("mapPlaidAccount") || syncService.includes("balances")) {
    recordPass("Balance mapping implemented in sync pipeline");
  } else {
    recordFail("Balance sync mapping not found");
  }

  if (
    fs.existsSync(path.join(ROOT, "lib/plaid/recurringDetectionService.ts")) &&
    fs.existsSync(path.join(ROOT, "lib/automation/providers/plaidAutomationProvider.ts"))
  ) {
    recordPass("Recurring transaction detection implemented");
  } else {
    recordFail("Recurring transaction detection missing");
  }
}

async function auditPlaidApiCredentials() {
  section("3. Plaid Production API");

  const clientId = getEnv("PLAID_CLIENT_ID");
  const secret = getEnv("PLAID_SECRET");

  if (!clientId || !secret || isPlaceholder(clientId) || isPlaceholder(secret)) {
    recordWarn("Skipping live Plaid API check (credentials incomplete)");
    return;
  }

  const client = new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments.production,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": clientId,
          "PLAID-SECRET": secret,
        },
      },
    }),
  );

  try {
    await client.categoriesGet({});
    recordPass("Production Plaid API credentials accepted (categories/get)");
  } catch (error) {
    const message =
      error?.response?.data?.error_message ||
      error?.response?.data?.display_message ||
      (error instanceof Error ? error.message : "Unknown Plaid API error");

    recordFail(
      `Production Plaid API rejected credentials: ${message}`,
      "Verify PLAID_CLIENT_ID and PLAID_SECRET are Production keys from the Plaid Dashboard",
    );
  }
}

async function auditWebhookEndpoint(webhookUrl, skipRemote) {
  section("4. Webhook endpoint");

  if (skipRemote) {
    recordWarn("Skipping remote webhook checks (--skip-remote)");
    return;
  }

  let healthResponse;

  try {
    healthResponse = await fetch(webhookUrl, { method: "GET" });
  } catch (error) {
    recordFail(
      `Unable to reach ${webhookUrl}: ${error instanceof Error ? error.message : "Unknown error"}`,
      `Deploy latest code and confirm ${webhookUrl} is publicly reachable`,
    );
    return;
  }

  if (healthResponse.status !== 200) {
    recordFail(
      `GET ${webhookUrl} returned HTTP ${healthResponse.status} (expected 200)`,
      "Merge/deploy Plaid production PR so GET /api/plaid/webhook health check is live",
    );
  } else {
    recordPass(`GET ${webhookUrl} returned HTTP 200`);
  }

  const healthBody = await healthResponse.json().catch(() => null);

  if (!healthBody?.ok) {
    recordFail("Webhook health response missing ok=true");
  } else {
    recordPass("Webhook health response ok=true");
  }

  if (healthBody?.environment === "production") {
    recordPass("Remote deployment reports Plaid environment: production");
  } else if (healthBody?.environment) {
    recordWarn(
      `Remote deployment reports Plaid environment: ${healthBody.environment}`,
      "Ensure Vercel PLAID_ENV=production",
    );
  }

  if (healthBody?.verificationRequired === true) {
    recordPass("Remote deployment requires webhook signature verification");
  } else if (healthBody) {
    recordWarn("Remote deployment may not require webhook verification");
  }

  if (healthBody?.webhookUrl === PRODUCTION_WEBHOOK_URL) {
    recordPass("Remote deployment uses production webhook URL");
  } else if (healthBody?.webhookUrl) {
    recordWarn(`Remote webhook URL is ${healthBody.webhookUrl}`);
  }

  if (healthBody?.configured === false) {
    recordWarn(
      "Remote deployment reports Plaid is not fully configured",
      "Complete all Plaid env vars on Vercel Production and redeploy",
    );
  } else if (healthBody?.configured === true) {
    recordPass("Remote deployment reports Plaid is configured");
  }

  try {
    const unsignedPost = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        webhook_type: "TRANSACTIONS",
        webhook_code: "SYNC_UPDATES_AVAILABLE",
        item_id: "readiness-check-item",
      }),
    });

    if (unsignedPost.status === 401) {
      recordPass("Unsigned webhook POST correctly rejected with HTTP 401");
    } else if (unsignedPost.status === 503) {
      recordWarn(
        "Unsigned webhook POST returned HTTP 503 (Plaid not configured on server)",
        "Set all Plaid env vars on Vercel before accepting production webhooks",
      );
    } else {
      recordFail(
        `Unsigned webhook POST returned HTTP ${unsignedPost.status} (expected 401)`,
        "Production webhooks must reject requests without Plaid-Verification header",
      );
    }
  } catch (error) {
    recordWarn(
      `Unable to POST webhook probe: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

function printChecklist() {
  section("Production readiness checklist");

  if (issues.length === 0 && warnings.length === 0) {
    console.log("\nAll checks passed. Buxme is ready to connect real bank accounts.");
    console.log("\nRecommended final steps:");
    console.log("  • Register webhook URL in Plaid Dashboard → Production");
    console.log("  • Connect one test bank account and confirm sync in Dashboard");
    return;
  }

  if (issues.length > 0) {
    console.log("\nBlockers (fix before connecting real bank accounts):");
    for (const item of [...new Set(issues)]) {
      console.log(`  ☐ ${item}`);
    }
  }

  if (warnings.length > 0) {
    console.log("\nWarnings / recommended actions:");
    for (const item of [...new Set(warnings)]) {
      console.log(`  ☐ ${item}`);
    }
  }

  console.log("\nManual steps still required:");
  console.log("  ☐ Register https://buxme.co/api/plaid/webhook in Plaid Dashboard (Production)");
  console.log("  ☐ Merge and deploy the Plaid production branch if webhook GET returns 405");
  console.log("  ☐ Set all Plaid env vars on Vercel Production (not Preview/Sandbox values)");
  console.log("  ☐ Connect a test bank account and verify balances, transactions, and recurring detection");
  console.log("  ☐ Existing Sandbox connections do not migrate — users must reconnect");

  console.log(`\nSummary: ${passed.length} passed, ${issues.length} blockers, ${warnings.length} warnings`);
}

async function main() {
  const args = process.argv.slice(2);
  const urlFlagIndex = args.indexOf("--url");
  const skipRemote = args.includes("--skip-remote");
  const webhookUrl =
    (urlFlagIndex >= 0 ? args[urlFlagIndex + 1] : "") ||
    getEnv("PLAID_WEBHOOK_URL") ||
    PRODUCTION_WEBHOOK_URL;

  console.log("Buxme Plaid Production Readiness Audit");
  console.log("======================================");

  auditEnvironmentVariables();
  auditImplementation();
  await auditPlaidApiCredentials();
  await auditWebhookEndpoint(webhookUrl, skipRemote);
  printChecklist();

  if (issues.length > 0) {
    process.exitCode = 1;
  }
}

main();
