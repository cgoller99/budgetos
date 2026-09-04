import "server-only";

import type { PaidSubscriptionPlan, SubscriptionStatus } from "@/lib/subscription/types";
import {
  canApplyAppleEntitlementToProfile,
  isAllowedAppleProductId,
  planFromVerifiedAppleProduct,
  shouldPreserveHigherApplePlan,
} from "@/lib/iap/appleEntitlementPolicy";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type VerifiedAppleSubscriptionSyncInput = {
  userId: string;
  productId: string;
  originalTransactionId: string;
  transactionId?: string | null;
  expiresAt: string;
  environment?: string | null;
  status?: Extract<SubscriptionStatus, "active" | "past_due">;
};

/**
 * Applies a *verified* Apple IAP entitlement to the user profile.
 * Refuses to overwrite an active Stripe subscription.
 * Refuses to let a lower Apple tier overwrite a higher active Apple tier
 * when the incoming originalTransactionId differs.
 */
export async function syncVerifiedAppleSubscriptionToProfile(
  input: VerifiedAppleSubscriptionSyncInput,
): Promise<{ plan: PaidSubscriptionPlan; status: string; preserved?: boolean }> {
  const plan = planFromVerifiedAppleProduct(input.productId);

  if (!plan || !isAllowedAppleProductId(input.productId)) {
    throw new Error(`Unknown Apple product: ${input.productId}`);
  }

  const admin = createSupabaseAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select(
      "id, subscription_plan, subscription_status, subscription_provider, stripe_subscription_id, apple_original_transaction_id",
    )
    .eq("id", input.userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!profile) {
    throw new Error("Profile not found.");
  }

  if (
    !canApplyAppleEntitlementToProfile({
      id: profile.id,
      subscriptionProvider: profile.subscription_provider,
      subscriptionStatus: profile.subscription_status,
      stripeSubscriptionId: profile.stripe_subscription_id,
      appleOriginalTransactionId: profile.apple_original_transaction_id,
    })
  ) {
    throw new Error(
      "You already have an active web subscription. Manage it on buxme.co or cancel it before buying in the App Store.",
    );
  }

  if (
    shouldPreserveHigherApplePlan({
      currentProvider: profile.subscription_provider,
      currentStatus: profile.subscription_status,
      currentPlan: profile.subscription_plan,
      currentOriginalTransactionId: profile.apple_original_transaction_id,
      incomingPlan: plan,
      incomingOriginalTransactionId: input.originalTransactionId,
    })
  ) {
    return {
      plan: profile.subscription_plan as PaidSubscriptionPlan,
      status: profile.subscription_status ?? "active",
      preserved: true,
    };
  }

  const { data: conflictingOwner, error: conflictError } = await admin
    .from("profiles")
    .select("id")
    .eq("apple_original_transaction_id", input.originalTransactionId)
    .neq("id", input.userId)
    .maybeSingle();

  if (conflictError) {
    throw conflictError;
  }

  if (conflictingOwner) {
    throw new Error(
      "This Apple subscription is already linked to another Buxme account.",
    );
  }

  const status = input.status ?? "active";

  const { error: updateError } = await admin
    .from("profiles")
    .update({
      subscription_plan: plan,
      subscription_status: status,
      subscription_provider: "apple",
      apple_product_id: input.productId,
      apple_original_transaction_id: input.originalTransactionId,
      apple_transaction_id: input.transactionId ?? null,
      apple_environment: input.environment ?? null,
      subscription_current_period_end: input.expiresAt,
      // Clear Stripe subscription pointers so entitlements stay single-sourced.
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.userId);

  if (updateError) {
    throw updateError;
  }

  return { plan, status };
}

/**
 * Removes Apple Premium access for a user while preserving audit identifiers.
 */
export async function clearAppleSubscriptionOnProfile(
  userId: string,
  options?: { clearIdentifiers?: boolean },
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, subscription_provider")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!profile) {
    return;
  }

  if (profile.subscription_provider === "stripe") {
    return;
  }

  const clearIdentifiers = options?.clearIdentifiers === true;

  const { error: updateError } = await admin
    .from("profiles")
    .update({
      subscription_plan: "free",
      subscription_status: "canceled",
      subscription_provider: clearIdentifiers ? "none" : "apple",
      subscription_current_period_end: null,
      ...(clearIdentifiers
        ? {
            apple_product_id: null,
            apple_original_transaction_id: null,
            apple_transaction_id: null,
            apple_environment: null,
          }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (updateError) {
    throw updateError;
  }
}

/**
 * Applies Apple status by originalTransactionId (ASN path).
 * Never clobbers an active Stripe entitlement.
 */
export async function applyAppleSubscriptionByOriginalTransaction(input: {
  originalTransactionId: string;
  productId: string;
  transactionId?: string | null;
  expiresAt: string | null;
  environment?: string | null;
  status: Extract<SubscriptionStatus, "active" | "past_due" | "canceled">;
}): Promise<{ updated: boolean; skippedReason?: string; userId?: string }> {
  const admin = createSupabaseAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select(
      "id, subscription_plan, subscription_provider, subscription_status, stripe_subscription_id, apple_original_transaction_id",
    )
    .eq("apple_original_transaction_id", input.originalTransactionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!profile) {
    return { updated: false, skippedReason: "no_matching_profile" };
  }

  if (
    !canApplyAppleEntitlementToProfile({
      id: profile.id,
      subscriptionProvider: profile.subscription_provider,
      subscriptionStatus: profile.subscription_status,
      stripeSubscriptionId: profile.stripe_subscription_id,
      appleOriginalTransactionId: profile.apple_original_transaction_id,
    })
  ) {
    return {
      updated: false,
      skippedReason: "active_stripe_entitlement_preserved",
      userId: profile.id,
    };
  }

  if (input.status === "canceled") {
    await clearAppleSubscriptionOnProfile(profile.id);
    return { updated: true, userId: profile.id };
  }

  if (!input.expiresAt) {
    return { updated: false, skippedReason: "missing_expiry", userId: profile.id };
  }

  const incomingPlan = planFromVerifiedAppleProduct(input.productId);
  if (
    incomingPlan &&
    shouldPreserveHigherApplePlan({
      currentProvider: profile.subscription_provider,
      currentStatus: profile.subscription_status,
      currentPlan: profile.subscription_plan,
      currentOriginalTransactionId: profile.apple_original_transaction_id,
      incomingPlan,
      incomingOriginalTransactionId: input.originalTransactionId,
    })
  ) {
    return {
      updated: false,
      skippedReason: "higher_apple_tier_preserved",
      userId: profile.id,
    };
  }

  await syncVerifiedAppleSubscriptionToProfile({
    userId: profile.id,
    productId: input.productId,
    originalTransactionId: input.originalTransactionId,
    transactionId: input.transactionId,
    expiresAt: input.expiresAt,
    environment: input.environment,
    status: input.status,
  });

  return { updated: true, userId: profile.id };
}

/** @deprecated Use syncVerifiedAppleSubscriptionToProfile after Apple verification. */
export async function syncAppleSubscriptionToProfile() {
  throw new Error(
    "Unverified Apple subscription sync is disabled. Use /api/iap/apple/verify with App Store Server API verification.",
  );
}
