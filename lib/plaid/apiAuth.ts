import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requirePlaidApiUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      supabase,
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  return {
    supabase,
    user,
    householdId: profile?.household_id ?? null,
    response: null,
  };
}

export function plaidErrorResponse(error: unknown, fallback = "Plaid request failed.") {
  const message = error instanceof Error ? error.message : fallback;

  return NextResponse.json(
    {
      error: message,
      code:
        message.includes("ITEM_LOGIN_REQUIRED") || message.includes("login again")
          ? "ITEM_LOGIN_REQUIRED"
          : "PLAID_ERROR",
    },
    { status: 500 },
  );
}
