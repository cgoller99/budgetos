import "server-only";

import { NextResponse } from "next/server";
import {
  PLAID_PRO_REQUIRED_CODE,
  PLAID_PRO_REQUIRED_MESSAGE,
  canCreateNewPlaidConnection,
  isNewPlaidConnectionAttempt,
  type PlaidLinkMode,
} from "@/lib/plaid/plaidEntitlementGate";
import { mapProfileToSubscription } from "@/lib/stripe/subscriptionMapper";
import { getEffectiveEntitlements } from "@/lib/subscription/entitlements.server";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";

export async function loadUserEntitlementsForPlaid(input: {
  supabase: BuxmeSupabaseClient;
  userId: string;
  email?: string | null;
}) {
  const { data: profile, error } = await input.supabase
    .from("profiles")
    .select(
      "email, subscription_plan, subscription_status, subscription_provider, stripe_customer_id, stripe_subscription_id, subscription_current_period_end, apple_product_id, apple_original_transaction_id, admin_founder_granted",
    )
    .eq("id", input.userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const subscription = mapProfileToSubscription(profile);
  return getEffectiveEntitlements({
    email: input.email ?? profile?.email,
    subscription,
    adminFounderGranted: profile?.admin_founder_granted,
  });
}

/**
 * Blocks Free users from starting a brand-new Plaid Link / Item.
 * Allows update/reconnect for grandfathered connections.
 */
export async function assertCanStartPlaidLink(input: {
  supabase: BuxmeSupabaseClient;
  userId: string;
  email?: string | null;
  mode: PlaidLinkMode;
}): Promise<NextResponse | null> {
  if (
    !isNewPlaidConnectionAttempt({
      mode: input.mode,
    })
  ) {
    return null;
  }

  const entitlements = await loadUserEntitlementsForPlaid(input);
  if (canCreateNewPlaidConnection({ hasProAccess: entitlements.hasProAccess })) {
    return null;
  }

  return NextResponse.json(
    {
      error: PLAID_PRO_REQUIRED_MESSAGE,
      code: PLAID_PRO_REQUIRED_CODE,
      upgradePlan: "pro",
    },
    { status: 403 },
  );
}

/**
 * Blocks Free users from creating a new bank_connections row.
 * Allows token refresh when the Item already belongs to the user.
 */
export async function assertCanExchangeNewPlaidItem(input: {
  supabase: BuxmeSupabaseClient;
  userId: string;
  email?: string | null;
  hasExistingItem: boolean;
}): Promise<NextResponse | null> {
  if (
    !isNewPlaidConnectionAttempt({
      mode: "create",
      hasExistingItem: input.hasExistingItem,
    })
  ) {
    return null;
  }

  const entitlements = await loadUserEntitlementsForPlaid(input);
  if (canCreateNewPlaidConnection({ hasProAccess: entitlements.hasProAccess })) {
    return null;
  }

  return NextResponse.json(
    {
      error: PLAID_PRO_REQUIRED_MESSAGE,
      code: PLAID_PRO_REQUIRED_CODE,
      upgradePlan: "pro",
    },
    { status: 403 },
  );
}
