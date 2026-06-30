import { NextResponse } from "next/server";
import { assertPlaidConfigured, getPlaidConfig } from "@/lib/plaid/config";
import { requirePlaidApiUser, plaidErrorResponse } from "@/lib/plaid/apiAuth";
import { syncPlaidForUser } from "@/lib/plaid/syncService";

type SyncRequestBody = {
  connectionId?: string;
};

export async function POST(request: Request) {
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

    const body = (await request.json().catch(() => ({}))) as SyncRequestBody;
    const results = await syncPlaidForUser({
      supabase: auth.supabase,
      userId: auth.user.id,
      connectionId: body.connectionId,
    });

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    console.error("[plaid/sync] Failed to sync bank data", error);
    return plaidErrorResponse(error, "Unable to sync bank data.");
  }
}
