#!/usr/bin/env node
/**
 * Pulls public environment variables from the live buxme.co deployment
 * into .env.local (never overwrites existing server-side secrets).
 *
 * Usage:
 *   npm run sync:env
 *   node scripts/sync-public-env-from-production.mjs --url https://buxme.co
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");
const DEFAULT_SITE = "https://buxme.co";

const PUBLIC_DEFAULTS = {
  NEXT_PUBLIC_SITE_URL: DEFAULT_SITE,
  PLAID_ENV: "production",
  PLAID_WEBHOOK_URL: `${DEFAULT_SITE}/api/plaid/webhook`,
  NEXT_PUBLIC_PLAID_ENABLED: "true",
  RESEND_FROM_EMAIL: "noreply@buxme.co",
  RESEND_FROM_NAME: "Buxme",
  NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
};

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return { lines: [], map: new Map() };

  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  const map = new Map();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    map.set(trimmed.slice(0, index).trim(), trimmed.slice(index + 1).trim());
  }

  return { lines, map };
}

function writeEnvFile(map) {
  const orderedKeys = [
    "# Supabase",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "",
    "# Site",
    "NEXT_PUBLIC_SITE_URL",
    "",
    "# Plaid Production",
    "PLAID_CLIENT_ID",
    "PLAID_SECRET",
    "PLAID_ENV",
    "PLAID_TOKEN_ENCRYPTION_KEY",
    "PLAID_WEBHOOK_URL",
    "NEXT_PUBLIC_PLAID_ENABLED",
    "",
    "# Stripe Live Mode",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRO_PRICE_ID",
    "STRIPE_PRO_PLUS_PRICE_ID",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_STRIPE_ENABLED",
    "NEXT_PUBLIC_STRIPE_PRO_PRICE",
    "NEXT_PUBLIC_STRIPE_PRO_PLUS_PRICE",
    "",
    "# Email",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "RESEND_FROM_NAME",
    "",
    "# Analytics",
    "NEXT_PUBLIC_POSTHOG_KEY",
    "NEXT_PUBLIC_POSTHOG_HOST",
    "",
    "# Security & access",
    "CRON_SECRET",
    "ADMIN_EMAILS",
    "FOUNDER_EMAILS",
  ];

  const written = new Set();
  const output = ["# Buxme local environment — never commit", ""];

  for (const entry of orderedKeys) {
    if (entry.startsWith("#") || entry === "") {
      output.push(entry);
      continue;
    }

    written.add(entry);
    const value = map.get(entry);
    if (value) {
      output.push(`${entry}=${value}`);
    } else {
      output.push(`# ${entry}=`);
    }
  }

  for (const [key, value] of map.entries()) {
    if (!written.has(key)) {
      output.push(`${key}=${value}`);
    }
  }

  output.push("");
  fs.writeFileSync(ENV_PATH, output.join("\n"));
}

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
  const siteUrl = (process.argv.find((arg, index) => process.argv[index - 1] === "--url") ?? DEFAULT_SITE).replace(/\/$/, "");
  const { map: existing } = parseEnvFile(ENV_PATH);
  const merged = new Map(existing);

  console.log(`Syncing public env from ${siteUrl} ...`);

  const source = await fetchSiteAssets(siteUrl);
  const discovered = extractPublicValues(source);

  for (const [key, value] of Object.entries(discovered)) {
    if (!merged.get(key)) {
      merged.set(key, value);
      console.log(`+ ${key}`);
    }
  }

  if (!merged.get("ADMIN_EMAILS")) {
    merged.set("ADMIN_EMAILS", "christiangoller99@gmail.com");
    console.log("+ ADMIN_EMAILS (default founder email)");
  }

  if (!merged.get("FOUNDER_EMAILS")) {
    merged.set("FOUNDER_EMAILS", "christiangoller99@gmail.com");
    console.log("+ FOUNDER_EMAILS (default founder email)");
  }

  if (!merged.get("CRON_SECRET")) {
    const { randomBytes } = await import("node:crypto");
    merged.set("CRON_SECRET", randomBytes(32).toString("hex"));
    console.log("+ CRON_SECRET (generated)");
  }

  if (!merged.get("NEXT_PUBLIC_STRIPE_PRO_PRICE")) {
    merged.set("NEXT_PUBLIC_STRIPE_PRO_PRICE", "$7.99");
  }

  if (!merged.get("NEXT_PUBLIC_STRIPE_PRO_PLUS_PRICE")) {
    merged.set("NEXT_PUBLIC_STRIPE_PRO_PLUS_PRICE", "$14.99");
  }

  writeEnvFile(merged);
  console.log(`\nWrote ${ENV_PATH}`);

  const missingSecrets = [
    "PLAID_CLIENT_ID",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRO_PRICE_ID",
    "STRIPE_PRO_PLUS_PRICE_ID",
    "RESEND_API_KEY",
    "NEXT_PUBLIC_POSTHOG_KEY",
  ].filter((name) => !merged.get(name));

  if (missingSecrets.length > 0) {
    console.log("\nStill missing server-side secrets:");
    for (const name of missingSecrets) {
      console.log(`  • ${name}`);
    }
    console.log("\nRun: vercel env pull .env.local --environment=production");
    console.log("Or copy them from Vercel → Project → Settings → Environment Variables.");
  } else {
    console.log("\nAll tracked env vars are present locally.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
