#!/usr/bin/env node
/**
 * Creates or verifies the Stripe webhook endpoint for buxme.co.
 * Prints the signing secret to add as STRIPE_WEBHOOK_SECRET on Vercel.
 *
 * Usage:
 *   npm run setup:stripe-webhook
 *   node --env-file=.env.local scripts/setup-stripe-webhook.mjs --url https://buxme.co
 */

import Stripe from "stripe";
import { hydrateProcessEnvFromFile } from "./lib/env-utils.mjs";

hydrateProcessEnvFromFile();

const siteArgIndex = process.argv.indexOf("--url");
const siteUrl = (
  siteArgIndex === -1 ? "https://buxme.co" : process.argv[siteArgIndex + 1]
).replace(/\/$/, "");
const webhookUrl = `${siteUrl}/api/stripe/webhook`;

const EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
];

function getEnv(name) {
  return process.env[name]?.trim() ?? "";
}

async function main() {
  const secretKey = getEnv("STRIPE_SECRET_KEY");

  if (!secretKey) {
    console.error("Missing STRIPE_SECRET_KEY.");
    console.error("Run: vercel env pull .env.local --environment=production");
    process.exit(1);
  }

  if (!secretKey.startsWith("sk_live_") && !secretKey.startsWith("sk_test_")) {
    console.error("STRIPE_SECRET_KEY looks invalid.");
    process.exit(1);
  }

  const stripe = new Stripe(secretKey);
  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  const match = existing.data.find((endpoint) => endpoint.url === webhookUrl);

  if (match) {
    console.log(`✓ Webhook endpoint already exists: ${webhookUrl}`);
    console.log(`  ID: ${match.id}`);
    console.log(`  Status: ${match.status}`);
    console.log("\n⚠ Stripe only shows the signing secret when the endpoint is created.");
    console.log("  If STRIPE_WEBHOOK_SECRET is missing on Vercel:");
    console.log("  1. Stripe Dashboard → Developers → Webhooks → select this endpoint");
    console.log("  2. Reveal signing secret → add to Vercel as STRIPE_WEBHOOK_SECRET");
    console.log("  3. Or delete and re-run this script to create a fresh endpoint.");
    return;
  }

  const endpoint = await stripe.webhookEndpoints.create({
    url: webhookUrl,
    enabled_events: EVENTS,
    description: "Buxme production subscription sync",
  });

  console.log(`✓ Created webhook endpoint: ${webhookUrl}`);
  console.log(`  ID: ${endpoint.id}`);
  console.log(`\nAdd to Vercel Production immediately:\n`);
  console.log(`  STRIPE_WEBHOOK_SECRET=${endpoint.secret}`);
  console.log("\nThen redeploy and verify:");
  console.log(`  curl -s ${siteUrl}/api/stripe/webhook | jq .webhookConfigured`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
