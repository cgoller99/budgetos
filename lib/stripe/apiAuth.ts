import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireStripeApiUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      supabase,
      user: null,
      profile: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "email, full_name, stripe_customer_id, stripe_subscription_id, subscription_plan, subscription_status, subscription_current_period_end, subscription_provider, apple_product_id, apple_original_transaction_id, admin_founder_granted, is_disabled",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  return {
    supabase,
    user,
    profile,
    response: null,
  };
}

export function stripeErrorResponse(error: unknown, fallback = "Stripe request failed.") {
  let message = fallback;

  if (error instanceof Error && error.message.trim()) {
    message = error.message;
  } else if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string" &&
    (error as { message: string }).message.trim()
  ) {
    message = (error as { message: string }).message;
  }

  return NextResponse.json(
    {
      error: message,
      code: "STRIPE_ERROR",
    },
    { status: 500 },
  );
}
