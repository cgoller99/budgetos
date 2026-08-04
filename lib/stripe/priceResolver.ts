import "server-only";

import type Stripe from "stripe";
import type { BillingInterval } from "@/lib/stripe/billingInterval";
import { getStripeConfig } from "@/lib/stripe/config";
import { missingPlanChangePriceError } from "@/lib/stripe/planChange";
import { getStripeClient } from "@/lib/stripe/stripeClient";

const resolvedPriceCache: Partial<
  Record<`${"pro" | "pro_plus"}:${BillingInterval}`, string>
> = {};

function getProductIdForPlan(plan: "pro" | "pro_plus"): string | undefined {
  const config = getStripeConfig();
  return plan === "pro_plus" ? config.proPlusProductId : config.proProductId;
}

function getConfiguredPriceId(
  plan: "pro" | "pro_plus",
  interval: BillingInterval,
): string | undefined {
  const config = getStripeConfig();

  if (interval === "year") {
    return plan === "pro_plus"
      ? config.proPlusYearlyPriceId
      : config.proYearlyPriceId;
  }

  return plan === "pro_plus" ? config.proPlusPriceId : config.proPriceId;
}

function pickRecurringPrice(
  prices: Stripe.Price[],
  interval: BillingInterval,
): Stripe.Price | undefined {
  const matchingInterval = prices.find(
    (price) => price.recurring?.interval === interval && price.active,
  );

  if (matchingInterval) {
    return matchingInterval;
  }

  const monthly = prices.find(
    (price) => price.recurring?.interval === "month" && price.active,
  );

  return monthly ?? prices.find((price) => price.active) ?? prices[0];
}

function pickExactRecurringPrice(
  prices: Stripe.Price[],
  interval: BillingInterval,
): Stripe.Price | undefined {
  return prices.find(
    (price) => price.recurring?.interval === interval && price.active,
  );
}

async function resolvePriceIdForPlanInternal(
  plan: "pro" | "pro_plus",
  interval: BillingInterval,
  options: { allowIntervalFallback: boolean },
): Promise<string> {
  const cacheKey = `${plan}:${interval}` as const;
  const configuredPriceId = getConfiguredPriceId(plan, interval);

  if (configuredPriceId) {
    resolvedPriceCache[cacheKey] = configuredPriceId;
    return configuredPriceId;
  }

  if (resolvedPriceCache[cacheKey]) {
    return resolvedPriceCache[cacheKey]!;
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
    limit: 20,
  });
  const selected = options.allowIntervalFallback
    ? pickRecurringPrice(prices.data, interval)
    : pickExactRecurringPrice(prices.data, interval);

  if (!selected?.id || selected.recurring?.interval !== interval) {
    throw new Error(
      `No active ${interval}ly recurring price found for Stripe product ${productId}.`,
    );
  }

  resolvedPriceCache[cacheKey] = selected.id;
  return selected.id;
}

export async function resolvePriceIdForPlan(
  plan: "pro" | "pro_plus",
  interval: BillingInterval = "month",
): Promise<string> {
  return resolvePriceIdForPlanInternal(plan, interval, {
    allowIntervalFallback: true,
  });
}

/**
 * Resolves a price for the exact billing interval only.
 * Never falls back to monthly/other intervals (used for plan changes).
 */
export async function resolvePriceIdForPlanStrict(
  plan: "pro" | "pro_plus",
  interval: BillingInterval,
): Promise<string> {
  try {
    return await resolvePriceIdForPlanInternal(plan, interval, {
      allowIntervalFallback: false,
    });
  } catch {
    throw new Error(missingPlanChangePriceError(plan, interval));
  }
}

export function rememberResolvedPriceId(
  plan: "pro" | "pro_plus",
  priceId: string,
  interval: BillingInterval = "month",
): void {
  resolvedPriceCache[`${plan}:${interval}`] = priceId;
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

  const knownPriceIds: Array<[string | undefined, "pro" | "pro_plus"]> = [
    [config.proPriceId, "pro"],
    [config.proYearlyPriceId, "pro"],
    [config.proPlusPriceId, "pro_plus"],
    [config.proPlusYearlyPriceId, "pro_plus"],
    [resolvedPriceCache["pro:month"], "pro"],
    [resolvedPriceCache["pro:year"], "pro"],
    [resolvedPriceCache["pro_plus:month"], "pro_plus"],
    [resolvedPriceCache["pro_plus:year"], "pro_plus"],
  ];

  for (const [knownPriceId, plan] of knownPriceIds) {
    if (knownPriceId && priceId === knownPriceId) {
      return plan;
    }
  }

  if (productId && productId === config.proPlusProductId) {
    if (priceId) {
      resolvedPriceCache["pro_plus:month"] = priceId;
    }

    return "pro_plus";
  }

  if (productId && productId === config.proProductId) {
    if (priceId) {
      resolvedPriceCache["pro:month"] = priceId;
    }

    return "pro";
  }

  return "free";
}
