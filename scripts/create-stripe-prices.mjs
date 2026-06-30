#!/usr/bin/env node
/**
 * Creates Buxme Pro and Pro+ recurring prices in Stripe test mode.
 *
 * Usage: node --env-file=.env.local scripts/create-stripe-prices.mjs
 */

import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

if (!secretKey) {
  console.error("STRIPE_SECRET_KEY is missing from the environment.");
  process.exit(1);
}

const stripe = new Stripe(secretKey, { typescript: true });

async function createPlanProduct(input) {
  const product = await stripe.products.create({
    name: input.name,
    description: input.description,
    metadata: {
      app: "buxme",
      plan: input.plan,
    },
  });

  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: input.unitAmount,
    recurring: {
      interval: "month",
    },
    metadata: {
      app: "buxme",
      plan: input.plan,
    },
  });

  return { product, price };
}

async function main() {
  const pro = await createPlanProduct({
    name: "Buxme Pro",
    description:
      "Household collaboration, shared finances, and priority support.",
    plan: "pro",
    unitAmount: 799,
  });

  const proPlus = await createPlanProduct({
    name: "Buxme Pro+",
    description:
      "Everything in Pro plus advanced reports and early access to new features.",
    plan: "pro_plus",
    unitAmount: 1499,
  });

  console.log("✓ Created Buxme billing prices\n");
  console.log(`Pro product:     ${pro.product.id}`);
  console.log(`Pro price:       ${pro.price.id}`);
  console.log(`Pro+ product:    ${proPlus.product.id}`);
  console.log(`Pro+ price:      ${proPlus.price.id}`);
  console.log("\nAdd to .env.local and Vercel:");
  console.log(`STRIPE_PRO_PRICE_ID=${pro.price.id}`);
  console.log(`STRIPE_PRO_PLUS_PRICE_ID=${proPlus.price.id}`);
  console.log("NEXT_PUBLIC_STRIPE_PRO_PRICE=$7.99");
  console.log("NEXT_PUBLIC_STRIPE_PRO_PLUS_PRICE=$14.99");
  console.log("NEXT_PUBLIC_STRIPE_ENABLED=true");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
