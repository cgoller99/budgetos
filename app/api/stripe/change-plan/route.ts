import { NextResponse } from "next/server";
import { requireStripeApiUser, stripeErrorResponse } from "@/lib/stripe/apiAuth";
import { assertStripeConfigured, getStripeConfig } from "@/lib/stripe/config";
import { changeSubscriptionPlan } from "@/lib/stripe/subscriptionService";
import { parsePaidPlan } from "@/lib/subscription/types";

type ChangePlanRequestBody = {
  plan?: string;
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

    const body = (await request.json()) as ChangePlanRequestBody;
    const targetPlan = parsePaidPlan(body.plan);

    if (!targetPlan) {
      return NextResponse.json(
        { error: "Plan must be pro or pro_plus." },
        { status: 400 },
      );
    }

    const subscription = await changeSubscriptionPlan({
      supabase: auth.supabase,
      userId: auth.user.id,
      targetPlan,
    });

    return NextResponse.json({ subscription });
  } catch (error) {
    console.error("[stripe/change-plan] Failed to change plan", error);
    return stripeErrorResponse(error, "Unable to change plan.");
  }
}
