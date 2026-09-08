import { NextResponse } from "next/server";
import { requireStripeApiUser, stripeErrorResponse } from "@/lib/stripe/apiAuth";
import { isStripeEnabled } from "@/lib/stripe/config";
import {
  getUserSubscription,
  refreshUserSubscriptionFromStripe,
} from "@/lib/stripe/subscriptionService";
import { clearAppleSubscriptionOnProfile } from "@/lib/iap/appleSubscriptionService";
import { getEffectiveEntitlements } from "@/lib/subscription/entitlements.server";
import {
  FREE_SUBSCRIPTION,
  hasActiveSubscription,
} from "@/lib/subscription/types";

export async function GET(request: Request) {
  try {
    const auth = await requireStripeApiUser();

    if (auth.response || !auth.user) {
      return auth.response!;
    }

    const url = new URL(request.url);
    const shouldRefresh =
      url.searchParams.get("refresh") === "true" ||
      url.searchParams.get("checkout") === "success";

    let subscription = FREE_SUBSCRIPTION;

    // Always read profile entitlements so Apple IAP subscribers are recognized.
    subscription = await getUserSubscription(auth.supabase, auth.user.id);

    // Hygiene fallback: expired Apple rows must not keep Premium forever if ASN was missed.
    if (
      subscription.provider === "apple" &&
      !hasActiveSubscription(subscription)
    ) {
      await clearAppleSubscriptionOnProfile(auth.user.id);
      subscription = await getUserSubscription(auth.supabase, auth.user.id);
    }

    if (
      isStripeEnabled() &&
      shouldRefresh &&
      subscription.provider !== "apple"
    ) {
      subscription = await refreshUserSubscriptionFromStripe(
        auth.supabase,
        auth.user.id,
      );
    }

    const entitlements = getEffectiveEntitlements({
      email: auth.user.email ?? auth.profile?.email,
      subscription,
      adminFounderGranted: auth.profile?.admin_founder_granted,
    });

    return NextResponse.json({
      isFounder: entitlements.isFounder,
      subscription: entitlements.subscription,
      hasProAccess: entitlements.hasProAccess,
      hasProPlusAccess: entitlements.hasProPlusAccess,
    });
  } catch (error) {
    console.error("[entitlements] Failed to resolve entitlements", error);
    return stripeErrorResponse(error, "Unable to load entitlements.");
  }
}
