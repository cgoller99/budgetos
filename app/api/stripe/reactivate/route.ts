import { NextResponse } from "next/server";
import { requireStripeApiUser, stripeErrorResponse } from "@/lib/stripe/apiAuth";
import { assertStripeConfigured, getStripeConfig } from "@/lib/stripe/config";
import { reactivateSubscription } from "@/lib/stripe/subscriptionService";

export async function POST() {
  try {
    const config = getStripeConfig();

    if (!config.isConfigured) {
      return NextResponse.json(
        {
          error: config.configurationError,
          code: "STRIPE_NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }

    assertStripeConfigured();
    const auth = await requireStripeApiUser();

    if (auth.response || !auth.user) {
      return auth.response!;
    }

    const subscription = await reactivateSubscription({
      supabase: auth.supabase,
      userId: auth.user.id,
    });

    return NextResponse.json({ subscription });
  } catch (error) {
    console.error("[stripe/reactivate] Failed to reactivate subscription", error);
    return stripeErrorResponse(error, "Unable to reactivate subscription.");
  }
}
