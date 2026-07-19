import "server-only";

import type Stripe from "stripe";
import type {
  PaidSubscriptionPlan,
  UserSubscription,
} from "@/lib/subscription/types";
import {
  assertStripeConfigured,
  getStripeConfig,
} from "@/lib/stripe/config";
import { resolvePriceIdForPlan } from "@/lib/stripe/priceResolver";
import type { BillingInterval } from "@/lib/stripe/billingInterval";
import {
  getSubscriptionPeriodEndIso,
  mapProfileToSubscription,
  mapStripeSubscriptionToUserSubscription,
} from "@/lib/stripe/subscriptionMapper";
import { getStripeClient } from "@/lib/stripe/stripeClient";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";

type ProfileStripeFields = {
  id: string;
  email: string | null;
  full_name: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_plan: string;
  subscription_status: string;
  subscription_current_period_end: string | null;
};

async function loadProfileByUserId(
  supabase: BuxmeSupabaseClient,
  userId: string,
): Promise<ProfileStripeFields | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, stripe_customer_id, stripe_subscription_id, subscription_plan, subscription_status, subscription_current_period_end",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function loadProfileByCustomerId(
  customerId: string,
): Promise<ProfileStripeFields | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, stripe_customer_id, stripe_subscription_id, subscription_plan, subscription_status, subscription_current_period_end",
    )
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

function persistSubscriptionFields(
  mapped: UserSubscription,
): Pick<
  ProfileStripeFields,
  | "stripe_customer_id"
  | "stripe_subscription_id"
  | "subscription_plan"
  | "subscription_status"
  | "subscription_current_period_end"
> {
  return {
    stripe_customer_id: mapped.stripeCustomerId,
    stripe_subscription_id: mapped.stripeSubscriptionId,
    subscription_plan: mapped.plan,
    subscription_status: mapped.status,
    subscription_current_period_end: mapped.currentPeriodEnd,
  };
}

export async function getUserSubscription(
  supabase: BuxmeSupabaseClient,
  userId: string,
): Promise<UserSubscription> {
  const profile = await loadProfileByUserId(supabase, userId);
  return mapProfileToSubscription(profile);
}

export async function refreshUserSubscriptionFromStripe(
  supabase: BuxmeSupabaseClient,
  userId: string,
): Promise<UserSubscription> {
  const profile = await loadProfileByUserId(supabase, userId);

  if (!profile?.stripe_customer_id) {
    return mapProfileToSubscription(profile);
  }

  try {
    const stripe = getStripeClient();
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripe_customer_id,
      status: "all",
      limit: 1,
      expand: ["data.items.data.price.product"],
    });
    const subscription = subscriptions.data[0];

    if (subscription) {
      await syncSubscriptionToProfile(subscription);
    } else {
      await clearSubscriptionOnProfile(profile.id);
    }
  } catch (error) {
    console.error("[stripe] Failed to refresh subscription from Stripe", error);
  }

  const refreshed = await loadProfileByUserId(supabase, userId);
  const mapped = mapProfileToSubscription(refreshed);

  if (profile.stripe_customer_id) {
    try {
      const stripe = getStripeClient();
      const subscriptions = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: "all",
        limit: 1,
      });
      const subscription = subscriptions.data[0];

      if (subscription) {
        return mapStripeSubscriptionToUserSubscription(subscription);
      }
    } catch {
      // Fall back to profile snapshot.
    }
  }

  return mapped;
}

async function clearSubscriptionOnProfile(userId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from("profiles")
    .update({
      stripe_subscription_id: null,
      subscription_plan: "free",
      subscription_status: "none",
      subscription_current_period_end: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
}

export async function getOrCreateStripeCustomer(input: {
  supabase: BuxmeSupabaseClient;
  userId: string;
  email: string | null;
  fullName: string | null;
}): Promise<string> {
  const profile = await loadProfileByUserId(input.supabase, input.userId);

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: input.email ?? undefined,
    name: input.fullName ?? undefined,
    metadata: {
      user_id: input.userId,
    },
  });

  const { error } = await input.supabase
    .from("profiles")
    .update({
      stripe_customer_id: customer.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.userId);

  if (error) {
    throw error;
  }

  return customer.id;
}

export async function createCheckoutSession(input: {
  supabase: BuxmeSupabaseClient;
  userId: string;
  email: string | null;
  fullName: string | null;
  targetPlan: PaidSubscriptionPlan;
  billingInterval?: BillingInterval;
}): Promise<string> {
  assertStripeConfigured();
  const config = getStripeConfig();
  const customerId = await getOrCreateStripeCustomer(input);
  const stripe = getStripeClient();
  const current = await getUserSubscription(input.supabase, input.userId);

  if (
    current.stripeSubscriptionId &&
    (current.status === "active" ||
      current.status === "trialing" ||
      current.status === "past_due")
  ) {
    throw new Error(
      "You already have an active subscription. Use plan change instead of checkout.",
    );
  }

  const priceId = await resolvePriceIdForPlan(
    input.targetPlan,
    input.billingInterval ?? "month",
  );

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: input.userId,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${config.siteUrl}/settings?checkout=success#billing`,
    cancel_url: `${config.siteUrl}/settings?checkout=canceled#billing`,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: {
        user_id: input.userId,
        plan: input.targetPlan,
      },
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  return session.url;
}

export async function changeSubscriptionPlan(input: {
  supabase: BuxmeSupabaseClient;
  userId: string;
  targetPlan: PaidSubscriptionPlan;
}): Promise<UserSubscription> {
  assertStripeConfigured();
  const profile = await loadProfileByUserId(input.supabase, input.userId);

  if (!profile?.stripe_subscription_id) {
    throw new Error("No active subscription found. Start checkout instead.");
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(
    profile.stripe_subscription_id,
    { expand: ["items.data.price.product"] },
  );
  const itemId = subscription.items.data[0]?.id;

  if (!itemId) {
    throw new Error("Subscription has no billable items.");
  }

  const priceId = await resolvePriceIdForPlan(input.targetPlan);

  const updated = await stripe.subscriptions.update(subscription.id, {
    items: [
      {
        id: itemId,
        price: priceId,
      },
    ],
    proration_behavior: "create_prorations",
    cancel_at_period_end: false,
    metadata: {
      ...subscription.metadata,
      plan: input.targetPlan,
    },
  });

  await syncSubscriptionToProfile(updated);
  return mapStripeSubscriptionToUserSubscription(updated);
}

export async function cancelSubscription(input: {
  supabase: BuxmeSupabaseClient;
  userId: string;
  atPeriodEnd?: boolean;
}): Promise<UserSubscription> {
  assertStripeConfigured();
  const profile = await loadProfileByUserId(input.supabase, input.userId);

  if (!profile?.stripe_subscription_id) {
    throw new Error("No subscription found to cancel.");
  }

  const stripe = getStripeClient();
  const atPeriodEnd = input.atPeriodEnd ?? true;

  const updated = atPeriodEnd
    ? await stripe.subscriptions.update(profile.stripe_subscription_id, {
        cancel_at_period_end: true,
      })
    : await stripe.subscriptions.cancel(profile.stripe_subscription_id);

  await syncSubscriptionToProfile(updated);
  return mapStripeSubscriptionToUserSubscription(updated);
}

export async function reactivateSubscription(input: {
  supabase: BuxmeSupabaseClient;
  userId: string;
}): Promise<UserSubscription> {
  assertStripeConfigured();
  const profile = await loadProfileByUserId(input.supabase, input.userId);

  if (!profile?.stripe_subscription_id) {
    throw new Error("No subscription found to reactivate.");
  }

  const stripe = getStripeClient();
  const updated = await stripe.subscriptions.update(
    profile.stripe_subscription_id,
    {
      cancel_at_period_end: false,
    },
  );

  await syncSubscriptionToProfile(updated);
  return mapStripeSubscriptionToUserSubscription(updated);
}

export async function createBillingPortalSession(input: {
  supabase: BuxmeSupabaseClient;
  userId: string;
  customerId: string;
}): Promise<string> {
  assertStripeConfigured();
  const config = getStripeConfig();
  const stripe = getStripeClient();

  const session = await stripe.billingPortal.sessions.create({
    customer: input.customerId,
    return_url: `${config.siteUrl}/settings#billing`,
  });

  return session.url;
}

export async function syncSubscriptionToProfile(
  subscription: Stripe.Subscription,
): Promise<void> {
  const mapped = mapStripeSubscriptionToUserSubscription(subscription);
  const customerId = mapped.stripeCustomerId;

  if (!customerId) {
    return;
  }

  const profile = await loadProfileByCustomerId(customerId);

  if (!profile) {
    console.warn(
      "[stripe] No profile found for customer",
      customerId,
      subscription.id,
    );
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      ...persistSubscriptionFields(mapped),
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (error) {
    throw error;
  }
}

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) {
    return;
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["items.data.price.product"],
  });
  await syncSubscriptionToProfile(subscription);

  const userId = session.client_reference_id?.trim();
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  if (userId && customerId) {
    const supabase = createSupabaseAdminClient();
    await supabase
      .from("profiles")
      .update({
        stripe_customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
  }
}

export { getSubscriptionPeriodEndIso };
