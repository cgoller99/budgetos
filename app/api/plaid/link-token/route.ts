import { NextResponse } from "next/server";
import { assertPlaidConfigured, getPlaidConfig } from "@/lib/plaid/config";
import { requirePlaidApiUser, plaidErrorResponse } from "@/lib/plaid/apiAuth";
import { createPlaidLinkToken } from "@/lib/plaid/plaidService";
import { getPlaidOAuthRedirectUri } from "@/lib/plaid/oauth";
import { BankConnectionsRepository } from "@/lib/supabase/repositories/bankConnectionsRepository";
import { decryptConnectionAccessToken } from "@/lib/plaid/plaidService";

type LinkTokenRequestBody = {
  connectionId?: string;
  mode?: "create" | "update";
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

    const body = (await request.json().catch(() => ({}))) as LinkTokenRequestBody;
    const mode = body.mode ?? (body.connectionId ? "update" : "create");

    console.info("[plaid/link-token] request", {
      userId: auth.user.id,
      mode,
      connectionId: body.connectionId ?? null,
      redirectUri: getPlaidOAuthRedirectUri(),
    });

    const repository = new BankConnectionsRepository(auth.supabase);
    let accessToken: string | null = null;

    if (mode === "update" && body.connectionId) {
      const connection = await repository.getConnectionById(
        auth.user.id,
        body.connectionId,
      );

      if (!connection) {
        console.warn("[plaid/link-token] connection not found", {
          userId: auth.user.id,
          connectionId: body.connectionId,
        });
        return NextResponse.json(
          { error: "Bank connection not found." },
          { status: 404 },
        );
      }

      accessToken = decryptConnectionAccessToken(connection);
    }

    const linkToken = await createPlaidLinkToken({
      userId: auth.user.id,
      mode,
      accessToken,
    });

    console.info("[plaid/link-token] created", {
      userId: auth.user.id,
      mode,
      linkTokenPrefix: `${linkToken.slice(0, 12)}…`,
    });

    return NextResponse.json({ linkToken });
  } catch (error) {
    console.error("[plaid/link-token] Failed to create link token", error);
    return plaidErrorResponse(error, "Unable to create Plaid link token.");
  }
}
