import { NextResponse } from "next/server";
import { assertPlaidConfigured, getPlaidConfig } from "@/lib/plaid/config";
import { requirePlaidApiUser, plaidErrorResponse } from "@/lib/plaid/apiAuth";
import { getPlaidUserDiagnostics } from "@/lib/plaid/diagnosticsService";
import { syncPlaidForUser } from "@/lib/plaid/syncService";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const config = getPlaidConfig();

    if (!config.isConfigured) {
      return NextResponse.json(
        {
          error: config.configurationError,
          code: "PLAID_NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }

    assertPlaidConfigured();
    const auth = await requirePlaidApiUser();

    if (auth.response || !auth.user) {
      return auth.response!;
    }

    const url = new URL(request.url);
    const shouldSync = url.searchParams.get("sync") === "true";
    const connectionId = url.searchParams.get("connectionId")?.trim() || undefined;

    const diagnostics = await getPlaidUserDiagnostics({
      supabase: auth.supabase,
      userId: auth.user.id,
    });

    if (!shouldSync) {
      return NextResponse.json({ ok: true, diagnostics });
    }

    const syncResults = await syncPlaidForUser({
      supabase: createSupabaseAdminClient(),
      userId: auth.user.id,
      connectionId,
    });

    const refreshedDiagnostics = await getPlaidUserDiagnostics({
      supabase: auth.supabase,
      userId: auth.user.id,
    });

    return NextResponse.json({
      ok: true,
      diagnostics: refreshedDiagnostics,
      syncResults,
    });
  } catch (error) {
    console.error("[plaid/diagnostics] Failed", error);
    return plaidErrorResponse(error, "Unable to load Plaid diagnostics.");
  }
}
