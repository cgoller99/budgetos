import type { BillingInterval } from "@/lib/stripe/billingInterval";
import type { PaidSubscriptionPlan } from "@/lib/subscription/types";

export type StripeRecurringPriceLike = {
  id?: string | null;
  recurring?: {
    interval?: string | null;
  } | null;
} | null;

export type PlanPriceIdsByInterval = {
  pro: Partial<Record<BillingInterval, string | undefined>>;
  pro_plus: Partial<Record<BillingInterval, string | undefined>>;
};

/**
 * Reads the recurring interval from the subscriber's current Stripe price.
 * Returns null when the price is missing or not a supported month/year interval.
 */
export function detectBillingIntervalFromStripePrice(
  price: StripeRecurringPriceLike | string | undefined,
): BillingInterval | null {
  if (!price || typeof price === "string") {
    return null;
  }

  const interval = price.recurring?.interval;

  if (interval === "month" || interval === "year") {
    return interval;
  }

  return null;
}

export function missingPlanChangePriceError(
  targetPlan: PaidSubscriptionPlan,
  interval: BillingInterval,
): string {
  const planLabel = targetPlan === "pro_plus" ? "Pro+" : "Pro";
  const intervalLabel = interval === "year" ? "yearly" : "monthly";
  const envHint =
    interval === "year"
      ? targetPlan === "pro_plus"
        ? "STRIPE_PRO_PLUS_YEARLY_PRICE_ID or STRIPE_PRO_PLUS_PRODUCT_ID"
        : "STRIPE_PRO_YEARLY_PRICE_ID or STRIPE_PRO_PRODUCT_ID"
      : targetPlan === "pro_plus"
        ? "STRIPE_PRO_PLUS_PRICE_ID or STRIPE_PRO_PLUS_PRODUCT_ID"
        : "STRIPE_PRO_PRICE_ID or STRIPE_PRO_PRODUCT_ID";

  return `Cannot change to ${planLabel} ${intervalLabel}: no matching live Stripe price is configured (${envHint}). Billing interval was not changed.`;
}

/**
 * Picks the destination price for a plan change at the caller's current interval.
 * Throws instead of falling back to a different interval.
 */
export function resolvePlanChangePriceId(input: {
  targetPlan: PaidSubscriptionPlan;
  currentInterval: BillingInterval;
  prices: PlanPriceIdsByInterval;
}): string {
  const priceId = input.prices[input.targetPlan][input.currentInterval]?.trim();

  if (!priceId) {
    throw new Error(
      missingPlanChangePriceError(input.targetPlan, input.currentInterval),
    );
  }

  return priceId;
}

/** Proration is intentional for in-app Pro ↔ Pro+ changes at the same interval. */
export const PLAN_CHANGE_PRORATION_BEHAVIOR = "create_prorations" as const;
