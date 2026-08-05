import "server-only";

import type { PaidSubscriptionPlan } from "@/lib/subscription/types";
import { planFromIapProductId } from "@/lib/iap/products";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type AppleSubscriptionSyncInput = {
  userId: string;
  productId: string;
  originalTransactionId: string;
  transactionId?: string | null;
  expiresAt?: string | null;
  environment?: "Sandbox" | "Production" | string | null;
};

/**
 * Applies an Apple IAP entitlement to the user profile.
 * Refuses to activate Apple billing when a paid Stripe subscription is already active.
 */
export async function syncAppleSubscriptionToProfile(
  input: AppleSubscriptionSyncInput,
): Promise<{ plan: PaidSubscriptionPlan | "free"; status: string }> {
  const plan = planFromIapProductId(input.productId);

  if (!plan) {
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

  const stripeActive =
    (profile.subscription_provider === "stripe" ||
      Boolean(profile.stripe_subscription_id)) &&
    (profile.subscription_status === "active" ||
      profile.subscription_status === "trialing" ||
      profile.subscription_status === "past_due");

  if (
    stripeActive &&
    profile.apple_original_transaction_id !== input.originalTransactionId
  ) {
    throw new Error(
      "You already have an active web subscription. Manage it on buxme.co or cancel it before buying in the App Store.",
    );
  }

  const { error: updateError } = await admin
    .from("profiles")
    .update({
      subscription_plan: plan,
      subscription_status: "active",
      subscription_provider: "apple",
      apple_product_id: input.productId,
      apple_original_transaction_id: input.originalTransactionId,
      apple_transaction_id: input.transactionId ?? null,
      apple_environment: input.environment ?? null,
      subscription_current_period_end: input.expiresAt ?? null,
      // Clear Stripe subscription pointers so entitlements stay single-sourced.
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.userId);

  if (updateError) {
    throw updateError;
  }

  return { plan, status: "active" };
}
