import { NextResponse } from "next/server";
import { requireStripeApiUser, stripeErrorResponse } from "@/lib/stripe/apiAuth";
import { assertStripeConfigured, getStripeConfig } from "@/lib/stripe/config";
import { createBillingPortalSession } from "@/lib/stripe/subscriptionService";
import { mapProfileToSubscription } from "@/lib/stripe/subscriptionMapper";

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

    const subscription = mapProfileToSubscription(auth.profile);
    const customerId = subscription.stripeCustomerId;

    if (!customerId) {
      return NextResponse.json(
        { error: "No billing account found. Upgrade to Pro first." },
        { status: 400 },
      );
    }

    const url = await createBillingPortalSession({
      supabase: auth.supabase,
      userId: auth.user.id,
      customerId,
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error("[stripe/portal] Failed to create portal session", error);
    return stripeErrorResponse(error, "Unable to open billing portal.");
  }
}
