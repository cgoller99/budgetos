import "server-only";

import { NextResponse } from "next/server";
import { resolveUserHouseholdId } from "@/lib/supabase/householdFinance";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlaidErrorMessage, extractPlaidError } from "@/lib/plaid/plaidClient";

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
      householdId: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const householdId = await resolveUserHouseholdId(supabase, user.id);

  return {
    supabase,
    user,
    householdId,
    response: null,
  };
}

function resolvePlaidErrorStatus(error: unknown): number {
  const plaidError = extractPlaidError(error);

  if (
    plaidError?.error_type === "INVALID_REQUEST" ||
    plaidError?.error_code === "INVALID_ACCESS_TOKEN" ||
    plaidError?.error_code === "INVALID_PUBLIC_TOKEN" ||
    plaidError?.error_code === "INVALID_FIELD"
  ) {
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

function resolvePlaidErrorCode(error: unknown): string {
  const plaidError = extractPlaidError(error);

  if (plaidError?.error_code) {
    return plaidError.error_code;
  }

  return messageIncludesLoginAgain(error) ? "ITEM_LOGIN_REQUIRED" : "PLAID_ERROR";
}

function messageIncludesLoginAgain(error: unknown): boolean {
  const message = getPlaidErrorMessage(error);
  return message.includes("ITEM_LOGIN_REQUIRED") || message.includes("login again");
}

export function plaidErrorResponse(error: unknown, fallback = "Plaid request failed.") {
  const plaidError = extractPlaidError(error);
  const message = getPlaidErrorMessage(error);
  const code = resolvePlaidErrorCode(error);

  return NextResponse.json(
    {
      error: message === "Unexpected Plaid error." ? fallback : message,
      code,
      error_type: plaidError?.error_type ?? null,
      error_code: plaidError?.error_code ?? null,
      error_message: plaidError?.error_message ?? null,
      display_message: plaidError?.display_message ?? null,
      request_id: plaidError?.request_id ?? null,
    },
    { status: resolvePlaidErrorStatus(error) },
  );
}
