import { NextResponse } from "next/server";
import { requireStripeApiUser, stripeErrorResponse } from "@/lib/stripe/apiAuth";
import { assertStripeConfigured, getStripeConfig } from "@/lib/stripe/config";
import { createCheckoutSession } from "@/lib/stripe/subscriptionService";
import { parsePaidPlan } from "@/lib/subscription/types";

import { parseBillingInterval } from "@/lib/stripe/billingInterval";

type CheckoutRequestBody = {
  plan?: string;
  billing?: string;
};

export async function POST(request: Request) {
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

    const body = (await request.json().catch(() => ({}))) as CheckoutRequestBody;
    const targetPlan = parsePaidPlan(body.plan) ?? "pro";
    const billingInterval = parseBillingInterval(body.billing);

    const url = await createCheckoutSession({
      supabase: auth.supabase,
      userId: auth.user.id,
      email: auth.profile?.email ?? auth.user.email ?? null,
      fullName: auth.profile?.full_name ?? null,
      targetPlan,
      billingInterval,
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error("[stripe/checkout] Failed to create checkout session", error);
    return stripeErrorResponse(error, "Unable to start checkout.");
  }
}
