import "server-only";

import type { ProfileUpdate } from "@/lib/supabase/database.types";

/**
 * Admin-only entitlement helpers for support/testing.
 * Updates local profile entitlement fields via the service-role client.
 * Never calls Stripe or Apple APIs to cancel/mutate remote subscriptions.
 */

export type AdminEntitlementPlan = "free" | "pro" | "pro_plus" | "founder";

export type AdminEntitlementSource =
  | "none"
  | "apple"
  | "stripe"
  | "founder"
  | "manual";

export type AdminEntitlementSnapshot = {
  subscriptionPlan: string;
  subscriptionStatus: string;
  subscriptionProvider: string;
  adminFounderGranted: boolean;
  isEnvFounder: boolean;
  stripeSubscriptionId: string | null;
  appleOriginalTransactionId: string | null;
  appleProductId: string | null;
  effectivePlan: AdminEntitlementPlan;
  entitlementSource: AdminEntitlementSource;
  hasExternalSubscriptionRisk: boolean;
};

export function resolveEffectiveAdminPlan(input: {
  subscriptionPlan: string;
  subscriptionStatus: string;
  adminFounderGranted: boolean;
  isEnvFounder: boolean;
}): AdminEntitlementPlan {
  if (input.isEnvFounder || input.adminFounderGranted) {
    return "founder";
  }

  const status = input.subscriptionStatus;
  const active =
    status === "active" || status === "trialing" || status === "past_due";

  if (!active) {
    return "free";
  }

  if (input.subscriptionPlan === "pro_plus") {
    return "pro_plus";
  }

  if (input.subscriptionPlan === "pro") {
    return "pro";
  }

  return "free";
}

export function resolveEntitlementSource(input: {
  effectivePlan: AdminEntitlementPlan;
  subscriptionProvider: string;
}): AdminEntitlementSource {
  if (input.effectivePlan === "founder") {
    return "founder";
  }

  if (input.effectivePlan === "free") {
    return "none";
  }

  if (input.subscriptionProvider === "apple") {
    return "apple";
  }

  if (input.subscriptionProvider === "stripe") {
    return "stripe";
  }

  return "manual";
}

export function buildEntitlementSnapshot(input: {
  subscriptionPlan: string;
  subscriptionStatus: string;
  subscriptionProvider: string | null | undefined;
  adminFounderGranted: boolean;
  isEnvFounder: boolean;
  stripeSubscriptionId: string | null;
  appleOriginalTransactionId: string | null;
  appleProductId: string | null;
}): AdminEntitlementSnapshot {
  const subscriptionProvider = input.subscriptionProvider?.trim() || "none";
  const effectivePlan = resolveEffectiveAdminPlan(input);
  const entitlementSource = resolveEntitlementSource({
    effectivePlan,
    subscriptionProvider,
  });

  const hasExternalSubscriptionRisk = Boolean(
    input.stripeSubscriptionId ||
      input.appleOriginalTransactionId ||
      subscriptionProvider === "apple" ||
      subscriptionProvider === "stripe",
  );

  return {
    subscriptionPlan: input.subscriptionPlan,
    subscriptionStatus: input.subscriptionStatus,
    subscriptionProvider,
    adminFounderGranted: input.adminFounderGranted,
    isEnvFounder: input.isEnvFounder,
    stripeSubscriptionId: input.stripeSubscriptionId,
    appleOriginalTransactionId: input.appleOriginalTransactionId,
    appleProductId: input.appleProductId,
    effectivePlan,
    entitlementSource,
    hasExternalSubscriptionRisk,
  };
}

export function entitlementPlanLabel(plan: AdminEntitlementPlan): string {
  switch (plan) {
    case "founder":
      return "Founder";
    case "pro_plus":
      return "Pro+";
    case "pro":
      return "Pro";
    default:
      return "Free";
  }
}

export function entitlementSourceLabel(source: AdminEntitlementSource): string {
  switch (source) {
    case "apple":
      return "Apple IAP";
    case "stripe":
      return "Stripe";
    case "founder":
      return "Founder/manual";
    case "manual":
      return "Founder/manual";
    default:
      return "none";
  }
}

/** Profile fields written for admin entitlement changes (service role only). */
export function buildEntitlementProfileUpdate(
  plan: AdminEntitlementPlan,
  nowIso: string,
): ProfileUpdate {
  switch (plan) {
    case "founder":
      return {
        admin_founder_granted: true,
        updated_at: nowIso,
      };
    case "pro":
      return {
        subscription_plan: "pro",
        subscription_status: "active",
        subscription_provider: "none",
        subscription_current_period_end: null,
        stripe_subscription_id: null,
        admin_founder_granted: false,
        apple_product_id: null,
        apple_original_transaction_id: null,
        apple_transaction_id: null,
        apple_environment: null,
        updated_at: nowIso,
      };
    case "pro_plus":
      return {
        subscription_plan: "pro_plus",
        subscription_status: "active",
        subscription_provider: "none",
        subscription_current_period_end: null,
        stripe_subscription_id: null,
        admin_founder_granted: false,
        apple_product_id: null,
        apple_original_transaction_id: null,
        apple_transaction_id: null,
        apple_environment: null,
        updated_at: nowIso,
      };
    case "free":
    default:
      return {
        subscription_plan: "free",
        subscription_status: "none",
        subscription_provider: "none",
        subscription_current_period_end: null,
        stripe_subscription_id: null,
        admin_founder_granted: false,
        apple_product_id: null,
        apple_original_transaction_id: null,
        apple_transaction_id: null,
        apple_environment: null,
        updated_at: nowIso,
      };
  }
}

/**
 * Test/support-only: clear Buxme's stored Apple IAP ownership columns so a
 * sandbox transaction can be associated again.
 *
 * Does not delete Auth users, cancel Apple/Stripe remotely, or touch Stripe ids.
 * When the profile is Apple-billed (or still carries Apple identifiers), local
 * Apple entitlement fields are also reset to Free/none for consistency.
 */
export function buildClearAppleIapBindingUpdate(nowIso: string): ProfileUpdate {
  return {
    apple_product_id: null,
    apple_original_transaction_id: null,
    apple_transaction_id: null,
    apple_environment: null,
    // Keep local entitlement coherent once ownership identifiers are removed.
    subscription_plan: "free",
    subscription_status: "none",
    subscription_provider: "none",
    subscription_current_period_end: null,
    updated_at: nowIso,
  };
}

export function profileHasAppleIapBinding(input: {
  appleOriginalTransactionId: string | null | undefined;
  appleTransactionId: string | null | undefined;
  appleProductId: string | null | undefined;
  appleEnvironment: string | null | undefined;
  subscriptionProvider: string | null | undefined;
}): boolean {
  return Boolean(
    input.appleOriginalTransactionId ||
      input.appleTransactionId ||
      input.appleProductId ||
      input.appleEnvironment ||
      input.subscriptionProvider === "apple",
  );
}

export function adminActionToEntitlementPlan(
  action: string,
): AdminEntitlementPlan | null {
  switch (action) {
    case "grant_founder":
      return "founder";
    case "grant_pro":
      return "pro";
    case "grant_pro_plus":
      return "pro_plus";
    case "remove_subscription":
      return "free";
    default:
      return null;
  }
}
