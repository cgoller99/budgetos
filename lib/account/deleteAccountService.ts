import "server-only";

import {
  HOUSEHOLD_OWNER_BLOCK_MESSAGE,
  isAppleManagedSubscription,
  isStripeSubscriptionActiveForDeletion,
  resolveHouseholdDeletionRole,
} from "@/lib/account/deleteAccountPolicy";
import { factoryResetUserFinance } from "@/lib/admin/factoryResetService";
import { getStripeConfig } from "@/lib/stripe/config";
import { getStripeClient } from "@/lib/stripe/stripeClient";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";

export class AccountDeletionBlockedError extends Error {
  readonly code = "ACCOUNT_DELETION_BLOCKED";

  constructor(message: string) {
    super(message);
    this.name = "AccountDeletionBlockedError";
  }
}

export type DeleteAccountResult = {
  deleted: boolean;
  alreadyDeleted?: boolean;
  plaidConnectionsRemoved: number;
  stripeSubscriptionCanceled: boolean;
  appleSubscriptionPresent: boolean;
  householdRole: ReturnType<typeof resolveHouseholdDeletionRole>;
};

async function loadHouseholdSnapshot(
  adminSupabase: BuxmeSupabaseClient,
  householdId: string | null,
): Promise<{
  householdId: string | null;
  ownerId: string | null;
  memberUserIds: string[];
}> {
  if (!householdId) {
    return { householdId: null, ownerId: null, memberUserIds: [] };
  }

  const [{ data: household, error: householdError }, { data: members, error: membersError }] =
    await Promise.all([
      adminSupabase
        .from("households")
        .select("id, owner_id")
        .eq("id", householdId)
        .maybeSingle(),
      adminSupabase
        .from("household_members")
        .select("user_id")
        .eq("household_id", householdId),
    ]);

  if (householdError) {
    throw householdError;
  }

  if (membersError) {
    throw membersError;
  }

  return {
    householdId,
    ownerId: household?.owner_id ?? null,
    memberUserIds: (members ?? []).map((row) => row.user_id),
  };
}

async function cancelStripeSubscriptionImmediate(subscriptionId: string): Promise<void> {
  const config = getStripeConfig();
  if (!config.isConfigured || !config.secretKey) {
    throw new Error(
      "Unable to cancel your Stripe subscription because billing is not configured. Contact support@buxme.co before deleting your account.",
    );
  }

  const stripe = getStripeClient();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  if (subscription.status === "canceled") {
    return;
  }

  await stripe.subscriptions.cancel(subscriptionId);
}

/**
 * Permanently deletes a Buxme user account and associated app data.
 * Keeps privileged credentials server-side. Does not delete Stripe Customer/invoices.
 * Does not cancel Apple App Store subscriptions.
 */
export async function deleteUserAccount(input: {
  adminSupabase: BuxmeSupabaseClient;
  userId: string;
}): Promise<DeleteAccountResult> {
  const { adminSupabase, userId } = input;

  const { data: authLookup, error: authLookupError } =
    await adminSupabase.auth.admin.getUserById(userId);

  if (authLookupError && !/not found|user not found/i.test(authLookupError.message)) {
    throw authLookupError;
  }

  const authUser = authLookup.user ?? null;

  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select(
      "id, household_id, subscription_provider, subscription_status, stripe_customer_id, stripe_subscription_id, apple_original_transaction_id, apple_product_id",
    )
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile && !authUser) {
    return {
      deleted: true,
      alreadyDeleted: true,
      plaidConnectionsRemoved: 0,
      stripeSubscriptionCanceled: false,
      appleSubscriptionPresent: false,
      householdRole: "none",
    };
  }

  const householdSnapshot = await loadHouseholdSnapshot(
    adminSupabase,
    profile?.household_id ?? null,
  );
  const householdRole = resolveHouseholdDeletionRole(userId, householdSnapshot);

  if (householdRole === "owner_with_members") {
    throw new AccountDeletionBlockedError(HOUSEHOLD_OWNER_BLOCK_MESSAGE);
  }

  if (householdRole === "member") {
    const { error: leaveError } = await adminSupabase
      .from("household_members")
      .delete()
      .eq("user_id", userId);

    if (leaveError) {
      throw leaveError;
    }

    if (profile) {
      const { error: clearHouseholdError } = await adminSupabase
        .from("profiles")
        .update({ household_id: null, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (clearHouseholdError) {
        throw clearHouseholdError;
      }
    }
  }

  const appleSubscriptionPresent = isAppleManagedSubscription({
    subscriptionProvider: profile?.subscription_provider,
    appleOriginalTransactionId: profile?.apple_original_transaction_id,
  });

  let stripeSubscriptionCanceled = false;
  const shouldCancelStripe = isStripeSubscriptionActiveForDeletion({
    subscriptionProvider: profile?.subscription_provider,
    subscriptionStatus: profile?.subscription_status,
    stripeSubscriptionId: profile?.stripe_subscription_id,
  });

  if (shouldCancelStripe && profile?.stripe_subscription_id) {
    await cancelStripeSubscriptionImmediate(profile.stripe_subscription_id);
    stripeSubscriptionCanceled = true;
  }

  let plaidConnectionsRemoved = 0;
  if (profile) {
    const reset = await factoryResetUserFinance({
      adminSupabase,
      userId,
    });
    plaidConnectionsRemoved = reset.plaidConnectionsRemoved;
  }

  // Clear circular household pointer before profile delete when sole owner.
  const soleOwnerHouseholdId =
    householdRole === "sole_owner" ? profile?.household_id ?? null : null;

  if (profile?.household_id) {
    await adminSupabase
      .from("profiles")
      .update({ household_id: null, updated_at: new Date().toISOString() })
      .eq("id", userId);
  }

  // Remove membership row if still present (sole owner / leftover cases).
  await adminSupabase.from("household_members").delete().eq("user_id", userId);

  // Sole-owner households have no remaining members — delete the empty household
  // rather than cascading through other users (there are none).
  if (soleOwnerHouseholdId) {
    await adminSupabase.from("households").delete().eq("id", soleOwnerHouseholdId);
  }

  if (profile) {
    const { error: profileDeleteError } = await adminSupabase
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileDeleteError) {
      throw new Error(
        `Account data cleanup failed before auth deletion: ${profileDeleteError.message}`,
      );
    }
  }

  if (authUser) {
    const { error: authDeleteError } = await adminSupabase.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      throw new Error(
        `Buxme data was removed but deleting the login failed: ${authDeleteError.message}. Contact support@buxme.co.`,
      );
    }
  }

  return {
    deleted: true,
    plaidConnectionsRemoved,
    stripeSubscriptionCanceled,
    appleSubscriptionPresent,
    householdRole,
  };
}
