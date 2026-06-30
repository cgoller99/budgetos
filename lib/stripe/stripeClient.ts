import "server-only";

import Stripe from "stripe";
import { assertStripeConfigured } from "@/lib/stripe/config";

let stripeClient: Stripe | null = null;

function createStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is missing.");
  }

  return new Stripe(secretKey, {
    typescript: true,
  });
}

export function getStripeClient(): Stripe {
  if (stripeClient) {
    return stripeClient;
  }

  assertStripeConfigured();
  stripeClient = createStripeClient();
  return stripeClient;
}

export function getStripeWebhookClient(): Stripe {
  return createStripeClient();
}
