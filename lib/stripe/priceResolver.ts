import "server-only";

import type Stripe from "stripe";
import { getStripeConfig } from "@/lib/stripe/config";
import { getStripeClient } from "@/lib/stripe/stripeClient";

const resolvedPriceCache: Partial<Record<"pro" | "pro_plus", string>> = {};

function getProductIdForPlan(plan: "pro" | "pro_plus"): string | undefined {
  const config = getStripeConfig();
  return plan === "pro_plus" ? config.proPlusProductId : config.proProductId;
}

function getConfiguredPriceId(plan: "pro" | "pro_plus"): string | undefined {
  const config = getStripeConfig();
  return plan === "pro_plus" ? config.proPlusPriceId : config.proPriceId;
}

function pickDefaultRecurringPrice(prices: Stripe.Price[]): Stripe.Price | undefined {
  const monthly = prices.find(
    (price) => price.recurring?.interval === "month" && price.active,
  );

  return monthly ?? prices.find((price) => price.active) ?? prices[0];
}

export async function resolvePriceIdForPlan(
  plan: "pro" | "pro_plus",
): Promise<string> {
  const configuredPriceId = getConfiguredPriceId(plan);

  if (configuredPriceId) {
    resolvedPriceCache[plan] = configuredPriceId;
    return configuredPriceId;
  }

  if (resolvedPriceCache[plan]) {
    return resolvedPriceCache[plan]!;
  }

  const productId = getProductIdForPlan(plan);

  if (!productId) {
    throw new Error(
      plan === "pro_plus"
        ? "STRIPE_PRO_PLUS_PRICE_ID or STRIPE_PRO_PLUS_PRODUCT_ID is missing."
        : "STRIPE_PRO_PRICE_ID or STRIPE_PRO_PRODUCT_ID is missing.",
    );
  }

  const stripe = getStripeClient();
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    type: "recurring",
    limit: 10,
  });
  const selected = pickDefaultRecurringPrice(prices.data);

  if (!selected?.id) {
    throw new Error(
      `No active recurring price found for Stripe product ${productId}.`,
    );
  }

  resolvedPriceCache[plan] = selected.id;
  return selected.id;
}

export function rememberResolvedPriceId(
  plan: "pro" | "pro_plus",
  priceId: string,
): void {
  resolvedPriceCache[plan] = priceId;
}

export function resolvePlanFromStripePrice(
  price: Stripe.Price | string | null | undefined,
): "free" | "pro" | "pro_plus" {
  if (!price) {
    return "free";
  }

  const config = getStripeConfig();
  const priceId = typeof price === "string" ? price : price.id;
  const productId =
    typeof price === "string"
      ? null
      : typeof price.product === "string"
        ? price.product
        : price.product?.id;

  if (priceId === config.proPlusPriceId || priceId === resolvedPriceCache.pro_plus) {
    return "pro_plus";
  }

  if (priceId === config.proPriceId || priceId === resolvedPriceCache.pro) {
    return "pro";
  }

  if (productId && productId === config.proPlusProductId) {
    if (priceId) {
      resolvedPriceCache.pro_plus = priceId;
    }

    return "pro_plus";
  }

  if (productId && productId === config.proProductId) {
    if (priceId) {
      resolvedPriceCache.pro = priceId;
    }

    return "pro";
  }

  return "free";
}
