#!/usr/bin/env node
/**
 * Pulls public environment variables from the live buxme.co deployment
 * into .env.local (never overwrites existing server-side secrets).
 *
 * Usage:
 *   npm run sync:env
 *   node scripts/sync-public-env-from-production.mjs --url https://buxme.co
 *   node scripts/sync-public-env-from-production.mjs --public-only
 */

import {
  ENV_PATH,
  mergeEnvMaps,
  parseEnvFile,
  writeEnvFile,
} from "./lib/env-utils.mjs";

const DEFAULT_SITE = "https://buxme.co";

const PUBLIC_DEFAULTS = {
  NEXT_PUBLIC_SITE_URL: DEFAULT_SITE,
  PLAID_ENV: "production",
  PLAID_WEBHOOK_URL: `${DEFAULT_SITE}/api/plaid/webhook`,
  NEXT_PUBLIC_PLAID_ENABLED: "true",
  RESEND_FROM_EMAIL: "noreply@buxme.co",
  RESEND_FROM_NAME: "Buxme",
  NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
  NEXT_PUBLIC_STRIPE_PRO_PRICE: "$7.99",
  NEXT_PUBLIC_STRIPE_PRO_PLUS_PRICE: "$14.99",
};

const PUBLIC_KEYS = new Set(Object.keys(PUBLIC_DEFAULTS));

async function fetchSiteAssets(siteUrl) {
  const html = await fetch(siteUrl).then((response) => response.text());
  const scripts = [...html.matchAll(/\/_next\/static\/[^"]+\.js/g)].map((match) => `${siteUrl}${match[0]}`);
  const uniqueScripts = [...new Set(scripts)];

  let combined = "";
  for (const scriptUrl of uniqueScripts) {
    combined += await fetch(scriptUrl).then((response) => response.text());
  }

  return combined;
}

function extractPublicValues(source) {
  const values = { ...PUBLIC_DEFAULTS };

  const jwtMatches = [...source.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)].map(
    (match) => match[0],
  );

  for (const token of jwtMatches) {
    try {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
      if (payload.ref && payload.role === "anon") {
        values.NEXT_PUBLIC_SUPABASE_ANON_KEY = token;
        values.NEXT_PUBLIC_SUPABASE_URL = `https://${payload.ref}.supabase.co`;
      }
    } catch {
      // ignore invalid tokens
    }
  }

  const publishable = source.match(/pk_live_[A-Za-z0-9]+/);
  if (publishable) {
    values.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = publishable[0];
    values.NEXT_PUBLIC_STRIPE_ENABLED = "true";
  }

  const posthog = source.match(/phc_[A-Za-z0-9]+/);
  if (posthog) {
    values.NEXT_PUBLIC_POSTHOG_KEY = posthog[0];
  }

  return values;
}

async function main() {
  const args = process.argv.slice(2);
  const publicOnly = args.includes("--public-only");
  const siteUrl = (args.find((arg, index) => args[index - 1] === "--url") ?? DEFAULT_SITE).replace(/\/$/, "");

  const existing = parseEnvFile(ENV_PATH);
  let merged = new Map(existing);

  console.log(`Syncing public env from ${siteUrl} ...`);

  const source = await fetchSiteAssets(siteUrl);
  const discovered = extractPublicValues(source);
  const patch = new Map(Object.entries(discovered));

  if (publicOnly) {
    for (const [key, value] of patch) {
      if (!PUBLIC_KEYS.has(key) && !key.startsWith("NEXT_PUBLIC_")) {
        continue;
      }
      if (!merged.has(key) || merged.get(key) === "") {
        merged.set(key, value);
        console.log(`+ ${key}`);
      }
    }
  } else {
    merged = mergeEnvMaps(existing, patch, { fillEmpty: true });

    for (const [key, value] of patch) {
      if (!existing.has(key) || existing.get(key) === "") {
        console.log(`+ ${key}`);
      }
    }

    if (!merged.has("ADMIN_EMAILS") || merged.get("ADMIN_EMAILS") === "") {
      merged.set("ADMIN_EMAILS", "christiangoller99@gmail.com");
      console.log("+ ADMIN_EMAILS (default founder email)");
    }

    if (!merged.has("FOUNDER_EMAILS") || merged.get("FOUNDER_EMAILS") === "") {
      merged.set("FOUNDER_EMAILS", "christiangoller99@gmail.com");
      console.log("+ FOUNDER_EMAILS (default founder email)");
    }

    if (!merged.has("CRON_SECRET") || merged.get("CRON_SECRET") === "") {
      const { randomBytes } = await import("node:crypto");
      merged.set("CRON_SECRET", randomBytes(32).toString("hex"));
      console.log("+ CRON_SECRET (generated locally — copy to Vercel Production if missing)");
    }
  }

  writeEnvFile(merged, ENV_PATH);
  console.log(`\nWrote ${ENV_PATH}`);
  console.log("Note: sync:env never removes keys pulled from Vercel, even when values are empty.");

  const secretKeys = [
    "PLAID_CLIENT_ID",
    "PLAID_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRO_PRICE_ID",
    "STRIPE_PRO_PLUS_PRICE_ID",
    "RESEND_API_KEY",
    "NEXT_PUBLIC_POSTHOG_KEY",
  ];

  const emptySecrets = secretKeys.filter((name) => merged.has(name) && merged.get(name) === "");
  const missingSecrets = secretKeys.filter((name) => !merged.has(name) || merged.get(name) === "");

  if (emptySecrets.length > 0) {
    console.log("\n⚠ Keys present but empty (set values in Vercel Production):");
    for (const name of emptySecrets) {
      console.log(`  • ${name}`);
    }
  }

  if (missingSecrets.length > 0) {
    console.log("\nStill missing or empty server-side secrets:");
    for (const name of missingSecrets) {
      console.log(`  • ${name}`);
    }
    console.log("\nRun: npm run audit:env");
  } else {
    console.log("\nAll tracked secret vars have values.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
