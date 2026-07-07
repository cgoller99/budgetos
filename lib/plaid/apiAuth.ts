import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlaidErrorMessage } from "@/lib/plaid/plaidService";
import type { PlaidError } from "plaid";

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

function resolvePlaidErrorStatus(error: unknown): number {
  const plaidError = error as PlaidError | undefined;

  if (plaidError?.error_code === "INVALID_PUBLIC_TOKEN") {
    return 400;
  }

  if (
    plaidError?.error_code === "ITEM_LOGIN_REQUIRED" ||
    messageIncludesLoginAgain(error)
  ) {
    return 409;
  }

  return 500;
}

function messageIncludesLoginAgain(error: unknown): boolean {
  const message = getPlaidErrorMessage(error);
  return message.includes("ITEM_LOGIN_REQUIRED") || message.includes("login again");
}

export function plaidErrorResponse(error: unknown, fallback = "Plaid request failed.") {
  const plaidError = error as PlaidError | undefined;
  const message = getPlaidErrorMessage(error);
  const code =
    plaidError?.error_code ??
    (messageIncludesLoginAgain(error) ? "ITEM_LOGIN_REQUIRED" : "PLAID_ERROR");

  return NextResponse.json(
    {
      error: message,
      code,
      error_type: plaidError?.error_type ?? null,
      error_code: plaidError?.error_code ?? null,
      error_message: plaidError?.error_message ?? message,
      display_message: plaidError?.display_message ?? null,
      request_id: plaidError?.request_id ?? null,
    },
    { status: resolvePlaidErrorStatus(error) },
  );
}
