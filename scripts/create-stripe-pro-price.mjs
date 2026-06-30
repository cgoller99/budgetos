#!/usr/bin/env node
/**
 * Creates a Buxme Pro recurring price in Stripe test mode.
 *
 * Usage: node --env-file=.env.local scripts/create-stripe-pro-price.mjs
 */

import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

if (!secretKey) {
  console.error("STRIPE_SECRET_KEY is missing from the environment.");
  process.exit(1);
}

const stripe = new Stripe(secretKey, { typescript: true });

async function main() {
  const product = await stripe.products.create({
    name: "Buxme Pro",
    description:
      "Household collaboration, advanced reports, priority support, and early access.",
    metadata: {
      app: "buxme",
      plan: "pro",
    },
  });

  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: 900,
    recurring: {
      interval: "month",
    },
    metadata: {
      app: "buxme",
      plan: "pro",
    },
  });

  console.log("✓ Created Buxme Pro product and monthly price\n");
  console.log(`Product ID: ${product.id}`);
  console.log(`Price ID:   ${price.id}`);
  console.log("\nAdd to .env.local and Vercel:");
  console.log(`STRIPE_PRO_PRICE_ID=${price.id}`);
  console.log("NEXT_PUBLIC_STRIPE_PRO_PRICE=$9");
  console.log("NEXT_PUBLIC_STRIPE_PRO_PERIOD=month");
  console.log("NEXT_PUBLIC_STRIPE_ENABLED=true");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
