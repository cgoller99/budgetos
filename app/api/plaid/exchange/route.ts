import { NextResponse } from "next/server";
import { assertPlaidConfigured, getPlaidConfig } from "@/lib/plaid/config";
import { requirePlaidApiUser, plaidErrorResponse } from "@/lib/plaid/apiAuth";
import {
  exchangePlaidPublicToken,
  getPlaidErrorMessage,
} from "@/lib/plaid/plaidService";
import { syncPlaidConnection } from "@/lib/plaid/syncService";
import { BankConnectionsRepository } from "@/lib/supabase/repositories/bankConnectionsRepository";

type ExchangeRequestBody = {
  publicToken?: string;
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

    const body = (await request.json()) as ExchangeRequestBody;
    const publicToken = body.publicToken?.trim();

    if (!publicToken) {
      return NextResponse.json(
        { error: "publicToken is required." },
        { status: 400 },
      );
    }

    const repository = new BankConnectionsRepository(auth.supabase);
    const exchangeResult = await exchangePlaidPublicToken(publicToken);
    const existing = await repository.getConnectionByItemId(
      auth.user.id,
      exchangeResult.itemId,
    );

    let connection = existing;

    if (connection) {
      await repository.updateConnectionTokens({
        connectionId: connection.id,
        userId: auth.user.id,
        encryptedToken: exchangeResult.encryptedToken,
        institutionName: exchangeResult.institutionName,
        institutionId: exchangeResult.institutionId,
      });
      connection =
        (await repository.getConnectionById(auth.user.id, connection.id)) ??
        connection;
    } else {
      connection = await repository.createConnection({
        userId: auth.user.id,
        householdId: auth.householdId,
        itemId: exchangeResult.itemId,
        institutionName: exchangeResult.institutionName,
        institutionId: exchangeResult.institutionId,
        encryptedToken: exchangeResult.encryptedToken,
      });
    }

    try {
      const syncResult = await syncPlaidConnection({
        supabase: auth.supabase,
        userId: auth.user.id,
        connection,
      });

      return NextResponse.json({
        ok: true,
        connectionId: connection.id,
        institutionName: connection.institution_name,
        sync: syncResult,
      });
    } catch (syncError) {
      return NextResponse.json(
        {
          ok: true,
          connectionId: connection.id,
          institutionName: connection.institution_name,
          syncError: getPlaidErrorMessage(syncError),
          code: "SYNC_FAILED",
        },
        { status: 202 },
      );
    }
  } catch (error) {
    console.error("[plaid/exchange] Failed to exchange public token", error);
    return plaidErrorResponse(error, "Unable to connect bank account.");
  }
}
