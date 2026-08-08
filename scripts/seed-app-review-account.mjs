#!/usr/bin/env node
/**
 * Idempotent App Review demo seed for ONE locked account.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-app-review-account.mjs
 *   node --env-file=.env.local scripts/seed-app-review-account.mjs --dry-run
 *
 * Safety:
 * - Targets ONLY christiangoller11@gmail.com
 * - Refuses any other --email
 * - Never writes subscription / auth credential fields
 * - Never writes investment/Plaid connection rows
 * - Skips records that already exist
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");
const LOCKED_EMAIL = "christiangoller11@gmail.com";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
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

function getFlag(name) {
  return process.argv.includes(`--${name}`);
}

function getArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

async function loadSeedModule() {
  // Prefer compiled-less TS via dynamic import of the source through ts-node/tsx if present;
  // otherwise fall back to invoking the Next/server module path is not available in plain node.
  // This CLI reuses the same logic by spawning a small inline copy via the TS file through jiti if available.
  const require = createRequire(import.meta.url);
  try {
    const jiti = require("jiti")(import.meta.url);
    return jiti(path.join(ROOT, "lib/admin/seedAppReviewAccount.ts"));
  } catch {
    // continue
  }

  try {
    return await import(pathToFileURL(path.join(ROOT, "lib/admin/seedAppReviewAccount.ts")).href);
  } catch {
    // continue
  }

  return null;
}

async function main() {
  const fileEnv = loadEnvFile(ENV_PATH);
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    fileEnv.NEXT_PUBLIC_SUPABASE_URL ??
    ""
  ).replace(/\/$/, "");
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    fileEnv.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Add them to .env.local (never commit) then re-run:\n" +
        "  node --env-file=.env.local scripts/seed-app-review-account.mjs",
    );
    process.exit(1);
  }

  const emailArg = getArg("email");
  if (emailArg && emailArg.trim().toLowerCase() !== LOCKED_EMAIL) {
    console.error(
      `Refusing --email ${emailArg}. This script is locked to ${LOCKED_EMAIL}.`,
    );
    process.exit(1);
  }

  const dryRun = getFlag("dry-run");
  const seedModule = await loadSeedModule();

  if (!seedModule?.seedAppReviewAccount) {
    console.error(
      "Unable to load lib/admin/seedAppReviewAccount.ts in this Node runtime.\n" +
        "Install jiti (dev) or run via the admin API after deploy:\n" +
        "  POST /api/admin/seed-app-review",
    );
    process.exit(1);
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`App Review seed · target ${LOCKED_EMAIL}${dryRun ? " · DRY RUN" : ""}`);

  const result = await seedModule.seedAppReviewAccount(admin, {
    email: LOCKED_EMAIL,
    dryRun,
  });

  const added = result.actions.filter((item) => item.action === "added");
  const skipped = result.actions.filter((item) => item.action === "skipped");
  const unchanged = result.actions.filter((item) => item.action === "unchanged");

  console.log(`\nUser: ${result.email} (${result.userId})`);
  console.log(
    `Subscription unchanged: ${result.subscriptionUnchanged} · plan=${result.subscriptionAfter.subscription_plan} status=${result.subscriptionAfter.subscription_status} provider=${result.subscriptionAfter.subscription_provider}`,
  );
  console.log(`\nAdded (${added.length}):`);
  for (const item of added) console.log(`  + [${item.entity}] ${item.detail}`);
  console.log(`\nSkipped (${skipped.length}):`);
  for (const item of skipped) console.log(`  · [${item.entity}] ${item.detail}`);
  console.log(`\nPreserved (${unchanged.length}):`);
  for (const item of unchanged) console.log(`  = [${item.entity}] ${item.detail}`);

  if (!result.subscriptionUnchanged) {
    console.error("\nERROR: subscription fields changed — investigate immediately.");
    process.exit(2);
  }

  console.log("\n✅ App Review seed finished.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
