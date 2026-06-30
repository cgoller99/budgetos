import { NextResponse } from "next/server";
import { requireStripeApiUser, stripeErrorResponse } from "@/lib/stripe/apiAuth";
import {
  getUserSubscription,
  refreshUserSubscriptionFromStripe,
} from "@/lib/stripe/subscriptionService";

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

    const subscription = shouldRefresh
      ? await refreshUserSubscriptionFromStripe(auth.supabase, auth.user.id)
      : await getUserSubscription(auth.supabase, auth.user.id);

    return NextResponse.json({ subscription });
  } catch (error) {
    console.error("[stripe/subscription] Failed to load subscription", error);
    return stripeErrorResponse(error, "Unable to load subscription.");
  }
}
