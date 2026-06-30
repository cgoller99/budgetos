import { NextResponse } from "next/server";
import { requireStripeApiUser, stripeErrorResponse } from "@/lib/stripe/apiAuth";
import { isStripeEnabled } from "@/lib/stripe/config";
import {
  getUserSubscription,
  refreshUserSubscriptionFromStripe,
} from "@/lib/stripe/subscriptionService";
import { getEffectiveEntitlements } from "@/lib/subscription/entitlements.server";
import { FREE_SUBSCRIPTION } from "@/lib/subscription/types";

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

    if (isStripeEnabled()) {
      subscription = shouldRefresh
        ? await refreshUserSubscriptionFromStripe(auth.supabase, auth.user.id)
        : await getUserSubscription(auth.supabase, auth.user.id);
    }

    const entitlements = getEffectiveEntitlements({
      email: auth.user.email ?? auth.profile?.email,
      subscription,
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
