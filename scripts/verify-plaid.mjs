#!/usr/bin/env node
/**
 * Buxme Plaid Production readiness audit.
 *
 * Production runtime (GET/POST /api/plaid/webhook) is authoritative.
 * Missing local secrets are warnings when the live deployment is healthy.
 *
 * Usage:
 *   npm run verify:plaid
 *   npm run verify:plaid -- --url https://buxme.co/api/plaid/webhook
 *   npm run verify:plaid -- --skip-remote   # code checks only (no runtime probe)
 */

import fs from "node:fs";
import path from "node:path";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import { getSecretVarNames } from "./lib/env-utils.mjs";
import {
  PRODUCTION_PLAID_WEBHOOK_URL,
  probePlaidProductionHealth,
} from "./lib/remote-production-health.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");
const PRODUCTION_WEBHOOK_URL = PRODUCTION_PLAID_WEBHOOK_URL;
const PRODUCTION_API_HOST = "production.plaid.com";

const PLACEHOLDER_PATTERNS = [
  /^your-/i,
  /^plaid_/i,
  /xxxx/i,
  /^change-me$/i,
];

const PLAID_ENV_VARS = [
  "PLAID_CLIENT_ID",
  "PLAID_SECRET",
  "PLAID_ENV",
  "PLAID_TOKEN_ENCRYPTION_KEY",
  "PLAID_WEBHOOK_URL",
  "NEXT_PUBLIC_PLAID_ENABLED",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const LOCAL_SECRET_VARS = new Set([
  ...getSecretVarNames().filter((name) => PLAID_ENV_VARS.includes(name)),
  "SUPABASE_SERVICE_ROLE_KEY",
]);

const REQUIRED_API_ROUTES = [
  { path: "app/api/plaid/webhook/route.ts", methods: ["GET", "POST"], label: "/api/plaid/webhook" },
  { path: "app/api/plaid/link-token/route.ts", methods: ["POST"], label: "/api/plaid/link-token" },
  { path: "app/api/plaid/exchange/route.ts", methods: ["POST"], label: "/api/plaid/exchange" },
  { path: "app/api/plaid/sync/route.ts", methods: ["POST"], label: "/api/plaid/sync" },
  { path: "app/api/plaid/disconnect/route.ts", methods: ["POST"], label: "/api/plaid/disconnect" },
  { path: "app/api/plaid/dismiss-recurring/route.ts", methods: ["POST"], label: "/api/plaid/dismiss-recurring" },
];

const REQUIRED_LIB_FILES = [
  "lib/plaid/config.ts",
  "lib/plaid/constants.ts",
  "lib/plaid/plaidClient.ts",
  "lib/plaid/plaidService.ts",
  "lib/plaid/syncService.ts",
  "lib/plaid/webhookVerification.ts",
  "lib/plaid/webhookProcessor.ts",
  "lib/plaid/webhookEvents.ts",
  "lib/plaid/mappers.ts",
  "lib/plaid/recurringDetectionService.ts",
  "lib/plaid/apiAuth.ts",
  "lib/plaid/tokenVault.ts",
];

/** Files where the word "sandbox" is allowed (type guards, explicit env handling). */
const SANDBOX_ALLOWLIST = new Set([
  "lib/plaid/config.ts",
  "lib/plaid/plaidClient.ts",
]);

const issues = [];
const warnings = [];
const passed = [];

let remoteHealthy = false;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values = {};

  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index === -1) continue;

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

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function isPlaceholder(value) {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

function recordPass(message) {
  passed.push(message);
  console.log(`✓ ${message}`);
}

function recordFail(message) {
  issues.push(message);
  console.error(`✗ ${message}`);
}

function recordWarn(message) {
  warnings.push(message);
  console.warn(`⚠ ${message}`);
}

function recordLocalEnvIssue(name, message) {
  if (remoteHealthy && (LOCAL_SECRET_VARS.has(name) || name.startsWith("PLAID_") || name === "NEXT_PUBLIC_PLAID_ENABLED")) {
    recordWarn(`${message} (production runtime is healthy — copy from provider dashboard for local dev)`);
    return;
  }

  recordFail(message);
}

function section(title) {
  console.log(`\n${title}`);
  console.log("-".repeat(title.length));
}

function auditEnvironmentVariables() {
  section("1. Plaid environment variables (local)");

  if (remoteHealthy) {
    console.log("Production runtime is healthy — missing local secrets are warnings only.\n");
  }

  for (const name of PLAID_ENV_VARS) {
    const value = getEnv(name);

    if (!value) {
      recordLocalEnvIssue(name, `${name} is missing`);
      continue;
    }

    if (isPlaceholder(value)) {
      recordLocalEnvIssue(name, `${name} is still a placeholder`);
      continue;
    }

    recordPass(`${name} is set locally`);
  }

  const encryptionKey = getEnv("PLAID_TOKEN_ENCRYPTION_KEY");
  if (encryptionKey && encryptionKey.length < 32) {
    recordLocalEnvIssue("PLAID_TOKEN_ENCRYPTION_KEY", "PLAID_TOKEN_ENCRYPTION_KEY must be at least 32 characters");
  }

  const plaidEnv = (getEnv("PLAID_ENV") || "production").toLowerCase();

  if (plaidEnv !== "production") {
    recordLocalEnvIssue("PLAID_ENV", `PLAID_ENV must be production (current: ${plaidEnv})`);
  } else if (getEnv("PLAID_ENV")) {
    recordPass("PLAID_ENV=production confirmed locally");
  }

  const webhookUrl = getEnv("PLAID_WEBHOOK_URL");

  if (webhookUrl !== PRODUCTION_WEBHOOK_URL) {
    recordLocalEnvIssue("PLAID_WEBHOOK_URL", `PLAID_WEBHOOK_URL must be ${PRODUCTION_WEBHOOK_URL}`);
  } else if (webhookUrl) {
    recordPass(`Local webhook URL configured: ${PRODUCTION_WEBHOOK_URL}`);
  }

  if (getEnv("NEXT_PUBLIC_PLAID_ENABLED") !== "true") {
    recordLocalEnvIssue("NEXT_PUBLIC_PLAID_ENABLED", "NEXT_PUBLIC_PLAID_ENABLED must be true");
  }
}

function auditProductionModeInCode() {
  section("2. Production mode in code");

  const config = read("lib/plaid/config.ts");
  const client = read("lib/plaid/plaidClient.ts");
  const service = read("lib/plaid/plaidService.ts");

  if (config.includes('return "production"')) {
    recordPass("PLAID_ENV defaults to production when unset");
  } else {
    recordFail("PLAID_ENV does not default to production");
  }

  if (config.includes("VERCEL_ENV") && config.includes('environment === "sandbox"')) {
    recordPass("Sandbox blocked on Vercel production deployments");
  } else {
    recordFail("Missing guard against sandbox on Vercel production");
  }

  if (client.includes("PlaidEnvironments.production")) {
    recordPass("Plaid client maps production environment to production.plaid.com");
  } else {
    recordFail("Plaid client missing production API host mapping");
  }

  if (service.includes("resolvePlaidWebhookUrl") && service.includes("webhook:")) {
    recordPass("Link token creation sets production webhook URL");
  } else {
    recordFail("Link token creation does not attach webhook URL");
  }

  if (service.includes('client_name: "Buxme"')) {
    recordPass("Link token uses Buxme client name");
  }
}

function auditApiEndpoints() {
  section("3. Required API endpoints");

  for (const route of REQUIRED_API_ROUTES) {
    const absolutePath = path.join(ROOT, route.path);

    if (!fs.existsSync(absolutePath)) {
      recordFail(`Missing API route file: ${route.label}`);
      continue;
    }

    const source = read(route.path);
    const missingMethods = route.methods.filter(
      (method) => !source.includes(`export async function ${method}`),
    );

    if (missingMethods.length > 0) {
      recordFail(`${route.label} missing handler(s): ${missingMethods.join(", ")}`);
    } else {
      recordPass(`${route.label} exists (${route.methods.join(", ")})`);
    }
  }
}

function auditSyncPipelines() {
  section("4. Sync pipelines");

  const sync = read("lib/plaid/syncService.ts");
  const mappers = read("lib/plaid/mappers.ts");

  const checks = [
    { ok: sync.includes("accountsGet"), pass: "Balance/account sync: accountsGet", fail: "Missing accountsGet for balance sync" },
    { ok: sync.includes("upsertLinkedAccounts"), pass: "Balance/account sync: upsertLinkedAccounts", fail: "Missing upsertLinkedAccounts" },
    { ok: mappers.includes("balances.current"), pass: "Balance mapping: current balance", fail: "Missing current balance mapping" },
    { ok: sync.includes("transactionsSync"), pass: "Transaction sync: transactionsSync", fail: "Missing transactionsSync" },
    { ok: sync.includes("persistSyncedTransactions"), pass: "Transaction sync: persistSyncedTransactions", fail: "Missing persistSyncedTransactions" },
    { ok: sync.includes("investmentsHoldingsGet"), pass: "Investments sync: investmentsHoldingsGet", fail: "Missing investmentsHoldingsGet" },
    { ok: sync.includes("upsertInvestmentHoldings"), pass: "Investments sync: upsertInvestmentHoldings", fail: "Missing upsertInvestmentHoldings" },
    { ok: sync.includes("liabilitiesGet"), pass: "Liabilities sync: liabilitiesGet", fail: "Missing liabilitiesGet" },
    { ok: sync.includes("detectPlaidRecurringCandidates") || fs.existsSync(path.join(ROOT, "lib/plaid/recurringDetectionService.ts")), pass: "Recurring transaction detection present", fail: "Missing recurring detection" },
  ];

  for (const check of checks) {
    if (check.ok) recordPass(check.pass);
    else recordFail(check.fail);
  }
}

function auditWebhookSecurity() {
  section("5. Webhook signature verification");

  const route = read("app/api/plaid/webhook/route.ts");
  const verification = read("lib/plaid/webhookVerification.ts");
  const processor = read("lib/plaid/webhookProcessor.ts");

  const checks = [
    { ok: route.includes("verifyPlaidWebhook"), pass: "Webhook route calls verifyPlaidWebhook", fail: "Webhook route missing signature verification" },
    { ok: route.includes("createSupabaseAdminClient"), pass: "Webhook uses Supabase service role client", fail: "Webhook must use service role client" },
    { ok: verification.includes("jwtVerify"), pass: "JWT signature verification (ES256)", fail: "Missing JWT verification" },
    { ok: verification.includes("request_body_sha256"), pass: "Body SHA-256 hash validation", fail: "Missing body hash validation" },
    { ok: verification.includes("webhookVerificationKeyGet"), pass: "Plaid JWK key fetch for verification", fail: "Missing Plaid verification key fetch" },
    { ok: verification.includes("timingSafeEqual"), pass: "Timing-safe hash comparison", fail: "Missing timing-safe hash comparison" },
    { ok: processor.includes("syncPlaidForUser"), pass: "Webhook triggers sync on transaction updates", fail: "Webhook processor missing sync trigger" },
    { ok: processor.includes("USER_PERMISSION_REVOKED"), pass: "Webhook handles connection revocation", fail: "Webhook missing revocation handling" },
  ];

  for (const check of checks) {
    if (check.ok) recordPass(check.pass);
    else recordFail(check.fail);
  }
}

function auditErrorHandlingAndLogging() {
  section("6. Error handling and logging");

  const sync = read("lib/plaid/syncService.ts");
  const webhook = read("app/api/plaid/webhook/route.ts");
  const apiAuth = read("lib/plaid/apiAuth.ts");

  const checks = [
    { ok: sync.includes("getPlaidErrorMessage"), pass: "Sync service uses structured Plaid error messages", fail: "Missing getPlaidErrorMessage in sync" },
    { ok: sync.includes("isPlaidItemLoginRequired"), pass: "Sync handles ITEM_LOGIN_REQUIRED", fail: "Missing login-required handling" },
    { ok: sync.includes("markConnectionSynced"), pass: "Sync persists connection error state", fail: "Missing connection error persistence" },
    { ok: sync.includes("while (hasMore)"), pass: "Transaction sync paginates until complete", fail: "Missing transaction sync pagination" },
    { ok: apiAuth.includes("plaidErrorResponse"), pass: "API routes use plaidErrorResponse helper", fail: "Missing plaidErrorResponse helper" },
    { ok: webhook.includes("tryLogAdminEvent"), pass: "Webhook logs events to admin audit log", fail: "Webhook missing admin event logging" },
    { ok: webhook.includes('console.error("[plaid/webhook]'), pass: "Webhook errors logged with [plaid/webhook] prefix", fail: "Webhook missing structured error logging" },
    { ok: read("app/api/plaid/sync/route.ts").includes('console.error("[plaid/sync]'), pass: "Sync API logs errors with [plaid/sync] prefix", fail: "Sync API missing error logging" },
  ];

  for (const check of checks) {
    if (check.ok) recordPass(check.pass);
    else recordFail(check.fail);
  }
}

function auditSandboxReferences() {
  section("7. Sandbox reference scan (Plaid code only)");

  const plaidDirs = ["lib/plaid", "app/api/plaid"];
  let foundUnexpected = false;

  for (const dir of plaidDirs) {
    const absoluteDir = path.join(ROOT, dir);

    for (const file of fs.readdirSync(absoluteDir, { recursive: true })) {
      if (typeof file !== "string" || !file.endsWith(".ts")) continue;

      const relativePath = path.join(dir, file).replace(/\\/g, "/");

      if (SANDBOX_ALLOWLIST.has(relativePath)) {
        recordPass(`Sandbox references in ${relativePath} are guarded (allowlisted)`);
        continue;
      }

      const content = read(relativePath);

      if (/sandbox/i.test(content)) {
        foundUnexpected = true;
        recordFail(`Unexpected sandbox reference in ${relativePath}`);
      }
    }
  }

  if (!foundUnexpected) {
    recordPass("No unexpected sandbox references in Plaid integration code");
  }
}

function auditRequiredLibFiles() {
  section("8. Required library modules");

  for (const relativePath of REQUIRED_LIB_FILES) {
    if (fs.existsSync(path.join(ROOT, relativePath))) {
      recordPass(`Found ${relativePath}`);
    } else {
      recordFail(`Missing ${relativePath}`);
    }
  }
}

async function auditPlaidProductionCredentials() {
  section("9. Production API credentials (local)");

  const clientId = getEnv("PLAID_CLIENT_ID");
  const secret = getEnv("PLAID_SECRET");

  if (!clientId || !secret || isPlaceholder(clientId) || isPlaceholder(secret)) {
    if (remoteHealthy) {
      recordWarn(
        "Skipping local Production credential check — PLAID_CLIENT_ID or PLAID_SECRET missing locally (production runtime is healthy)",
      );
      return;
    }

    recordFail("Cannot verify Production credentials — PLAID_CLIENT_ID or PLAID_SECRET missing");
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
    recordPass(`Production Client ID and Secret accepted by ${PRODUCTION_API_HOST}`);
  } catch (error) {
    const message =
      error?.response?.data?.error_message ||
      error?.response?.data?.display_message ||
      (error instanceof Error ? error.message : "Unknown error");

    recordFail(`Production credentials rejected: ${message}`);
  }
}

async function auditRemoteWebhook(webhookUrl, skipRemote) {
  section("0. Production runtime (authoritative)");

  if (skipRemote) {
    recordWarn("Remote webhook checks skipped — run without --skip-remote to validate buxme.co");
    return;
  }

  const result = await probePlaidProductionHealth(
    webhookUrl.replace(/\/api\/plaid\/webhook\/?$/, ""),
  );

  remoteHealthy = result.healthy;

  for (const check of result.checks) {
    recordPass(check);
  }

  for (const error of result.errors) {
    recordFail(error);
  }
}

function printSummary(skipRemote) {
  section("Result");

  const uniqueIssues = [...new Set(issues)];
  const uniqueWarnings = [...new Set(warnings)];

  if (uniqueWarnings.length > 0) {
    console.log(`\n⚠ ${uniqueWarnings.length} local warning(s) (non-blocking while production is healthy):`);
    for (const item of uniqueWarnings) {
      console.log(`  • ${item}`);
    }
  }

  if (uniqueIssues.length === 0) {
    console.log("\n✅ Plaid integration is production-ready.");
    console.log(`   ${passed.length} checks passed.`);
    if (skipRemote) {
      console.log("\n   Re-run without --skip-remote to validate the live webhook on buxme.co.");
    } else if (remoteHealthy) {
      console.log("\n   Production runtime verified on buxme.co.");
    } else {
      console.log("\n   Final manual step: register the webhook URL in Plaid Dashboard → Production.");
    }
    return;
  }

  console.log(`\n❌ Plaid integration is NOT production-ready.`);
  console.log(`   ${passed.length} passed, ${uniqueIssues.length} failed.\n`);
  console.log("Fix these before connecting real bank accounts:");
  for (const item of uniqueIssues) {
    console.log(`  • ${item}`);
  }
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

  await auditRemoteWebhook(webhookUrl, skipRemote);

  auditEnvironmentVariables();
  auditProductionModeInCode();
  auditRequiredLibFiles();
  auditApiEndpoints();
  auditSyncPipelines();
  auditWebhookSecurity();
  auditErrorHandlingAndLogging();
  auditSandboxReferences();
  await auditPlaidProductionCredentials();
  printSummary(skipRemote);

  process.exit(issues.length > 0 ? 1 : 0);
}

main();
