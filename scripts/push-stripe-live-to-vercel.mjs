#!/usr/bin/env node
/**
 * Force-pushes live Stripe env vars from .env.local to Vercel Production
 * and redeploys. Use this when checkout fails because production is still
 * on sk_test_ / pk_test_ keys.
 *
 * Usage:
 *   npx vercel login
 *   npm run push:stripe-live
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  ENV_PATH,
  hydrateProcessEnvFromFile,
  parseEnvFile,
} from "./lib/env-utils.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

const STRIPE_VARS = [
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRO_PRICE_ID",
  "STRIPE_PRO_PLUS_PRICE_ID",
  "STRIPE_PRO_PRODUCT_ID",
  "STRIPE_PRO_PLUS_PRODUCT_ID",
  "STRIPE_PRO_YEARLY_PRICE_ID",
  "STRIPE_PRO_PLUS_YEARLY_PRICE_ID",
  "NEXT_PUBLIC_STRIPE_ENABLED",
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
    env: process.env,
  });

  if (result.status !== 0 && !options.allowFail) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  return result;
}

function getLocal(name, local) {
  return (process.env[name]?.trim() || local.get(name) || "").trim();
}

function upsertVercelEnv(name, value) {
  console.log(`→ Vercel Production: ${name}`);
  const result = run(
    "npx",
    [
      "vercel",
      "env",
      "add",
      name,
      "production",
      "--value",
      value,
      "--sensitive",
      "--force",
      "--yes",
    ],
    { allowFail: true, stdio: "inherit" },
  );

  if (result.status !== 0) {
    console.error(`Failed to set ${name} on Vercel.`);
    process.exit(result.status ?? 1);
  }
}

function main() {
  hydrateProcessEnvFromFile();

  if (!fs.existsSync(ENV_PATH)) {
    console.error("Missing .env.local — add live Stripe keys first.");
    process.exit(1);
  }

  const whoami = run("npx", ["vercel", "whoami"], { allowFail: true });
  if (whoami.status !== 0) {
    console.error("Not logged in to Vercel. Run: npx vercel login");
    process.exit(1);
  }

  if (!fs.existsSync(path.join(ROOT, ".vercel", "project.json"))) {
    console.log("Linking Vercel project…");
    run("npx", ["vercel", "link", "--yes", "--project", "budgetos"], {
      stdio: "inherit",
    });
  }

  const local = parseEnvFile(ENV_PATH);
  const secret = getLocal("STRIPE_SECRET_KEY", local);
  const publishable = getLocal("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", local);
  const webhook = getLocal("STRIPE_WEBHOOK_SECRET", local);

  if (!secret.startsWith("sk_live_")) {
    console.error("STRIPE_SECRET_KEY in .env.local must start with sk_live_");
    process.exit(1);
  }

  if (!publishable.startsWith("pk_live_")) {
    console.error(
      "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in .env.local must start with pk_live_",
    );
    process.exit(1);
  }

  if (!webhook.startsWith("whsec_")) {
    console.error(
      "STRIPE_WEBHOOK_SECRET missing in .env.local. Run: npm run setup:stripe-webhook",
    );
    process.exit(1);
  }

  console.log("Pushing live Stripe vars to Vercel Production…\n");

  for (const name of STRIPE_VARS) {
    const value = getLocal(name, local);
    if (!value) {
      continue;
    }

    if (name === "NEXT_PUBLIC_STRIPE_ENABLED" && value !== "true") {
      console.error("NEXT_PUBLIC_STRIPE_ENABLED must be true");
      process.exit(1);
    }

    upsertVercelEnv(name, value);
  }

  console.log("\nRedeploying production…");
  run("npx", ["vercel", "deploy", "--prod", "--yes"], { stdio: "inherit" });

  console.log("\nVerifying…");
  run("node", ["scripts/audit-production-remote.mjs", "--public-launch"], {
    allowFail: true,
    stdio: "inherit",
  });

  console.log(
    "\nDone. Confirm: curl -s https://buxme.co/api/health/launch | jq '{stripeLiveMode,stripeWebhookConfigured}'",
  );
}

main();
