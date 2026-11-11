import "server-only";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import { getVerifiedProductionSubscriptionStatus } from "@/lib/iap/appleServerClient";
import { syncVerifiedAppleSubscriptionToProfile } from "@/lib/iap/appleSubscriptionService";

/** Explicit admin reconciliation through the normal, guarded Apple service. */
export async function reconcileActiveAppleSubscription(admin: BuxmeSupabaseClient, userId: string) {
  const { data: row, error } = await admin.from("profiles")
    .select("id, subscription_provider, stripe_subscription_id, apple_original_transaction_id, apple_transaction_id, apple_environment")
    .eq("id", userId).maybeSingle();
  if (error || !row || row.subscription_provider !== "apple" || row.apple_environment !== "Production" || row.stripe_subscription_id || !row.apple_original_transaction_id) {
    throw new Error("An existing production Apple subscription without a Stripe subscription is required.");
  }
  const apple = await getVerifiedProductionSubscriptionStatus(row.apple_original_transaction_id);
  if (apple.appleStatus !== "active" || apple.revoked || !apple.productId || !apple.expiresAt || Date.parse(apple.expiresAt) <= Date.now()) {
    throw new Error("Only a currently active, verified Apple subscription can be reconciled.");
  }
  await syncVerifiedAppleSubscriptionToProfile({
    userId: row.id, productId: apple.productId,
    originalTransactionId: row.apple_original_transaction_id,
    transactionId: row.apple_transaction_id,
    expiresAt: apple.expiresAt, environment: "Production", status: "active",
  });
  return { synced: true, expiresAt: apple.expiresAt };
}
