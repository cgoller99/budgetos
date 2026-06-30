import { NextResponse } from "next/server";
import { requireStripeApiUser, stripeErrorResponse } from "@/lib/stripe/apiAuth";
import { assertStripeConfigured, getStripeConfig } from "@/lib/stripe/config";
import { cancelSubscription } from "@/lib/stripe/subscriptionService";

type CancelRequestBody = {
  atPeriodEnd?: boolean;
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

    const body = (await request.json().catch(() => ({}))) as CancelRequestBody;
    const subscription = await cancelSubscription({
      supabase: auth.supabase,
      userId: auth.user.id,
      atPeriodEnd: body.atPeriodEnd ?? true,
    });

    return NextResponse.json({ subscription });
  } catch (error) {
    console.error("[stripe/cancel] Failed to cancel subscription", error);
    return stripeErrorResponse(error, "Unable to cancel subscription.");
  }
}
