import type Stripe from "stripe";
import type {
  PaidSubscriptionPlan,
  SubscriptionPlan,
  SubscriptionProvider,
  SubscriptionStatus,
  UserSubscription,
} from "@/lib/subscription/types";
import { FREE_SUBSCRIPTION } from "@/lib/subscription/types";
import { resolvePlanFromStripePrice } from "@/lib/stripe/priceResolver";
import type { ProfileRow } from "@/lib/supabase/database.types";

type SubscriptionProfileFields = Pick<
  ProfileRow,
  | "stripe_customer_id"
  | "stripe_subscription_id"
  | "subscription_plan"
  | "subscription_status"
  | "subscription_current_period_end"
> & {
  subscription_provider?: string | null;
  apple_product_id?: string | null;
  apple_original_transaction_id?: string | null;
};

function normalizeProvider(
  value: string | null | undefined,
): SubscriptionProvider {
  if (value === "stripe" || value === "apple") {
    return value;
  }

  return "none";
}

function normalizePlan(value: string | null | undefined): SubscriptionPlan {
  if (value === "pro_plus") {
    return "pro_plus";
  }

  if (value === "pro") {
    return "pro";
  }

  return "free";
}

function normalizeStatus(value: string | null | undefined): SubscriptionStatus {
  switch (value) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "incomplete":
      return value;
    default:
      return "none";
  }
}

export function mapProfileToSubscription(
  profile: SubscriptionProfileFields | null | undefined,
): UserSubscription {
  if (!profile) {
    return FREE_SUBSCRIPTION;
  }

  return {
    plan: normalizePlan(profile.subscription_plan),
    status: normalizeStatus(profile.subscription_status),
    provider: normalizeProvider(profile.subscription_provider),
    currentPeriodEnd: profile.subscription_current_period_end,
    cancelAtPeriodEnd: false,
    stripeCustomerId: profile.stripe_customer_id,
    stripeSubscriptionId: profile.stripe_subscription_id,
    stripePriceId: null,
    appleProductId: profile.apple_product_id ?? null,
    appleOriginalTransactionId: profile.apple_original_transaction_id ?? null,
  };
}

export function mapStripeSubscriptionStatus(
  status: string | null | undefined,
): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "incomplete":
    case "incomplete_expired":
    case "unpaid":
      return status === "incomplete_expired" || status === "unpaid"
        ? "canceled"
        : (status as SubscriptionStatus);
    default:
      return "none";
  }
}

export function getSubscriptionPriceId(
  subscription: Stripe.Subscription,
): string | null {
  return subscription.items.data[0]?.price?.id ?? null;
}

export function mapStripeSubscriptionToUserSubscription(
  subscription: Stripe.Subscription,
): UserSubscription {
  const status = mapStripeSubscriptionStatus(subscription.status);
  const price = subscription.items.data[0]?.price ?? null;
  const priceId = typeof price === "string" ? price : price?.id ?? null;
  const planFromPrice = resolvePlanFromStripePrice(price);
  const plan: SubscriptionPlan =
    status === "active" ||
    status === "trialing" ||
    status === "past_due"
      ? planFromPrice
      : "free";

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  return {
    plan,
    status,
    provider: "stripe",
    currentPeriodEnd: getSubscriptionPeriodEndIso(subscription),
    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: priceId,
    appleProductId: null,
    appleOriginalTransactionId: null,
  };
}

export function getSubscriptionPeriodEndIso(
  subscription: Stripe.Subscription,
): string | null {
  const periodEnd = (
    subscription as Stripe.Subscription & { current_period_end?: number }
  ).current_period_end;

  if (!periodEnd) {
    return null;
  }

  return new Date(periodEnd * 1000).toISOString();
}

export function isPaidTargetPlan(
  plan: SubscriptionPlan,
): plan is PaidSubscriptionPlan {
  return plan === "pro" || plan === "pro_plus";
}
