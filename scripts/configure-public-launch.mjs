#!/usr/bin/env node
/**
 * One-shot public launch configuration for buxme.co.
 *
 * Reads secrets from .env.local and pushes missing Production vars to Vercel,
 * creates the Stripe webhook (when STRIPE_SECRET_KEY is set), applies Supabase
 * auth URLs (when SUPABASE_ACCESS_TOKEN is set), and optionally redeploys.
 *
 * Usage:
 *   npm run configure:public-launch
 *   npm run configure:public-launch -- --dry-run
 *   npm run configure:public-launch -- --skip-deploy
 *
 * Required in .env.local for full automation:
 *   STRIPE_SECRET_KEY (sk_live_ for public billing)
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_live_)
 *   NEXT_PUBLIC_POSTHOG_KEY (phc_...)
 *   SUPABASE_ACCESS_TOKEN (optional — auto-configures auth URLs)
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import Stripe from "stripe";
import {
  ENV_PATH,
  hydrateProcessEnvFromFile,
  parseEnvFile,
} from "./lib/env-utils.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const SITE_URL = "https://buxme.co";
const WEBHOOK_URL = `${SITE_URL}/api/stripe/webhook`;

const LAUNCH_VARS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRO_PRICE_ID",
  "STRIPE_PRO_PLUS_PRICE_ID",
  "STRIPE_PRO_PRODUCT_ID",
  "STRIPE_PRO_PLUS_PRODUCT_ID",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_STRIPE_ENABLED",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "NEXT_PUBLIC_POSTHOG_HOST",
];

const STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
];

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const skipDeploy = args.includes("--skip-deploy");

function run(command, commandArgs = [], { allowFail = false } = {}) {
  if (dryRun) {
    console.log(`[dry-run] ${command} ${commandArgs.join(" ")}`);
    return true;
  }

  const result = spawnSync(command, commandArgs, {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0 && !allowFail) {
    process.exit(result.status ?? 1);
  }

  return result.status === 0;
}

function getEnv(name) {
  return process.env[name]?.trim() ?? "";
}

function listVercelEnvNames() {
  const result = spawnSync("npx", ["vercel", "env", "ls", "production"], {
    cwd: ROOT,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    console.error("Failed to list Vercel env vars. Run: npx vercel login");
    process.exit(1);
  }

  const names = new Set();
  for (const line of result.stdout.split("\n")) {
    const match = line.match(/^\s+([A-Z0-9_]+)\s+/);
    if (match) {
      names.add(match[1]);
    }
  }

  return names;
}

function addVercelEnv(name, value) {
  console.log(`+ Vercel Production: ${name}`);

  if (dryRun) {
    return;
  }

  const result = spawnSync(
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
      "--yes",
    ],
    {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    },
  );

  if (result.status !== 0) {
    console.error(`Failed to add ${name} to Vercel.`);
    process.exit(result.status ?? 1);
  }
}

async function ensureStripeWebhook(secretKey) {
  const stripe = new Stripe(secretKey);
  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  const match = existing.data.find((endpoint) => endpoint.url === WEBHOOK_URL);

  if (match) {
    console.log(`✓ Stripe webhook exists: ${WEBHOOK_URL} (${match.id})`);
    return getEnv("STRIPE_WEBHOOK_SECRET") || null;
  }

  if (dryRun) {
    console.log(`[dry-run] Would create Stripe webhook at ${WEBHOOK_URL}`);
    return null;
  }

  const endpoint = await stripe.webhookEndpoints.create({
    url: WEBHOOK_URL,
    enabled_events: STRIPE_WEBHOOK_EVENTS,
    description: "Buxme production subscription sync",
  });

  console.log(`✓ Created Stripe webhook: ${WEBHOOK_URL}`);
  console.log(`  Signing secret: ${endpoint.secret.slice(0, 12)}…`);
  return endpoint.secret;
}

function printManualChecklist(missing) {
  console.log("\nManual steps still required:\n");

  for (const item of missing) {
    console.log(`  • ${item}`);
  }

  console.log("\nCopy values into .env.local, then re-run:");
  console.log("  npm run configure:public-launch\n");
  console.log("Verify:");
  console.log("  npm run audit:public-launch");
  console.log("  docs/SMOKE_TEST.md (real iPhone + Android)");
}

async function main() {
  hydrateProcessEnvFromFile();

  console.log("Buxme public launch configuration\n");

  const whoami = spawnSync("npx", ["vercel", "whoami"], {
    cwd: ROOT,
    encoding: "utf8",
  });

  if (whoami.status !== 0) {
    console.error("Not logged in to Vercel. Run: npx vercel login");
    process.exit(1);
  }

  if (!fs.existsSync(path.join(ROOT, ".vercel", "project.json"))) {
    console.log("Linking Vercel project…");
    run("npx", ["vercel", "link", "--yes", "--project", "budgetos"]);
  }

  const local = parseEnvFile(ENV_PATH);
  const vercelNames = listVercelEnvNames();
  const manual = [];

  console.log("\n1/4 Push missing launch env vars to Vercel Production\n");

  for (const name of LAUNCH_VARS) {
    const value = getEnv(name) || local.get(name) || "";
    if (!value) {
      if (!vercelNames.has(name)) {
        manual.push(`${name} — add in provider dashboard, then .env.local`);
      }
      continue;
    }

    if (vercelNames.has(name)) {
      console.log(`  skip ${name} (already on Vercel)`);
      continue;
    }

    addVercelEnv(name, value);
    vercelNames.add(name);
  }

  console.log("\n2/4 Stripe webhook + live mode check\n");

  const stripeKey = getEnv("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    manual.push(
      "STRIPE_SECRET_KEY — set sk_live_… in .env.local (production currently uses test keys)",
    );
  } else {
    if (!stripeKey.startsWith("sk_live_")) {
      manual.push(
        "STRIPE_SECRET_KEY — must be sk_live_ for public billing (currently sk_test_ or invalid)",
      );
    }

    const publishable = getEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
    if (publishable && !publishable.startsWith("pk_live_")) {
      manual.push("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — must be pk_live_ for public billing");
    }

    let webhookSecret = getEnv("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret && !dryRun) {
      webhookSecret = await ensureStripeWebhook(stripeKey);
      if (webhookSecret && !vercelNames.has("STRIPE_WEBHOOK_SECRET")) {
        addVercelEnv("STRIPE_WEBHOOK_SECRET", webhookSecret);
        vercelNames.add("STRIPE_WEBHOOK_SECRET");
      }
    } else if (!webhookSecret) {
      manual.push(
        "STRIPE_WEBHOOK_SECRET — run npm run setup:stripe-webhook or add from Stripe Dashboard",
      );
    }
  }

  console.log("\n3/4 Supabase auth URLs\n");

  const authResult = spawnSync(
    "node",
    ["--env-file=.env.local", "scripts/configure-supabase-auth-urls.mjs"],
    { cwd: ROOT, encoding: "utf8", stdio: "pipe" },
  );

  process.stdout.write(authResult.stdout ?? "");
  if (authResult.stderr) {
    process.stderr.write(authResult.stderr);
  }

  if (!getEnv("SUPABASE_ACCESS_TOKEN")) {
    manual.push(
      "Supabase auth URLs — set SUPABASE_ACCESS_TOKEN or paste URLs from configure:supabase-auth-urls in dashboard",
    );
  }

  console.log("\n4/4 PostHog + deploy\n");

  if (!getEnv("NEXT_PUBLIC_POSTHOG_KEY") && !vercelNames.has("NEXT_PUBLIC_POSTHOG_KEY")) {
    manual.push("NEXT_PUBLIC_POSTHOG_KEY — PostHog → Project Settings → Project API Key (phc_…)");
  }

  if (!skipDeploy && manual.length === 0) {
    console.log("Redeploying production…");
    run("npx", ["vercel", "deploy", "--prod", "--yes"]);
  } else if (!skipDeploy && manual.length > 0) {
    console.log("Skipping deploy until manual items are resolved.");
  }

  console.log("\nRunning public launch audit…\n");
  run("node", ["scripts/audit-production-remote.mjs", "--public-launch"], {
    allowFail: true,
  });

  if (manual.length > 0) {
    printManualChecklist([...new Set(manual)]);
    process.exit(1);
  }

  console.log("\n✅ Public launch configuration complete.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
