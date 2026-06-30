import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isFounderEmail } from "@/lib/founder/emails";
import { mapProfileToSubscription } from "@/lib/stripe/subscriptionMapper";
import { getRequiredPlanForPath } from "@/lib/subscription/plans";
import { hasMinimumPlan } from "@/lib/subscription/types";
import { getSupabaseConfig } from "@/lib/supabase/config";

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

export async function proxy(request: NextRequest) {
  const { url, anonKey, isConfigured } = getSupabaseConfig();

  if (!isConfigured || !url || !anonKey) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        supabaseResponse = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const requiredPlan = getRequiredPlanForPath(pathname);
  if (user && requiredPlan) {
    if (isFounderEmail(user.email)) {
      return supabaseResponse;
    }

    const stripeEnabled = process.env.NEXT_PUBLIC_STRIPE_ENABLED === "true";

    if (!stripeEnabled) {
      return supabaseResponse;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "subscription_plan, subscription_status, stripe_customer_id, stripe_subscription_id, subscription_current_period_end",
      )
      .eq("id", user.id)
      .maybeSingle();

    const subscription = mapProfileToSubscription(profile);

    if (!hasMinimumPlan(subscription, requiredPlan)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/settings";
      redirectUrl.hash = "billing";
      redirectUrl.searchParams.set("upgrade", requiredPlan);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
