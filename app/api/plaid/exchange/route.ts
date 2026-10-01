import { NextResponse, after } from "next/server";
import { assertPlaidConfigured, getPlaidConfig } from "@/lib/plaid/config";
import { requirePlaidApiUser, plaidErrorResponse } from "@/lib/plaid/apiAuth";
import {
  exchangePlaidPublicToken,
  getPlaidErrorMessage,
} from "@/lib/plaid/plaidService";
import { assertCanExchangeNewPlaidItem } from "@/lib/plaid/requirePlaidProAccess";
import { syncPlaidConnection } from "@/lib/plaid/syncService";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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

    console.info("[plaid/exchange] request", {
      userId: auth.user.id,
      hasPublicToken: Boolean(publicToken),
      publicTokenPrefix: publicToken ? `${publicToken.slice(0, 12)}…` : null,
      connectionId: body.connectionId ?? null,
    });

    if (!publicToken) {
      return NextResponse.json(
        { error: "publicToken is required.", code: "INVALID_REQUEST" },
        { status: 400 },
      );
    }

    const repository = new BankConnectionsRepository(auth.supabase);
    const exchangeResult = await exchangePlaidPublicToken(publicToken);
    const existing = await repository.getConnectionByItemId(
      auth.user.id,
      exchangeResult.itemId,
    );

    const entitlementBlock = await assertCanExchangeNewPlaidItem({
      supabase: auth.supabase,
      userId: auth.user.id,
      email: auth.user.email,
      hasExistingItem: Boolean(existing),
    });
    if (entitlementBlock) {
      return entitlementBlock;
    }

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
      const admin = createSupabaseAdminClient();
      const syncResult = await syncPlaidConnection({
        supabase: admin,
        userId: auth.user.id,
        connection,
        // Return after incremental sync so Link UX is not blocked by 730-day backfill.
        awaitHistoricalBackfill: false,
      });

      const historyImportPending = Boolean(syncResult.historyImportDeferred);

      // Reliable fallback when webhooks are delayed/missing: finish historical
      // import after the response is sent (does not depend on client Sync).
      if (historyImportPending) {
        const connectionId = connection.id;
        const userId = auth.user.id;
        after(async () => {
          try {
            const latest =
              (await new BankConnectionsRepository(admin).getConnectionById(
                userId,
                connectionId,
              )) ?? connection;
            console.info("[plaid/exchange] starting deferred historical backfill", {
              userId,
              connectionId,
            });
            await syncPlaidConnection({
              supabase: admin,
              userId,
              connection: latest,
              awaitHistoricalBackfill: true,
            });
            console.info("[plaid/exchange] deferred historical backfill complete", {
              userId,
              connectionId,
            });
          } catch (backfillError) {
            console.warn("[plaid/exchange] deferred historical backfill failed", {
              userId,
              connectionId,
              syncError: getPlaidErrorMessage(backfillError),
            });
          }
        });
      }

      console.info("[plaid/exchange] success", {
        userId: auth.user.id,
        connectionId: connection.id,
        itemId: exchangeResult.itemId,
        institutionName: connection.institution_name,
        historyImportPending,
      });

      return NextResponse.json({
        ok: true,
        connectionId: connection.id,
        institutionName: connection.institution_name,
        historyImportPending,
        sync: syncResult,
      });
    } catch (syncError) {
      console.warn("[plaid/exchange] connected but initial sync failed", {
        userId: auth.user.id,
        connectionId: connection.id,
        syncError: getPlaidErrorMessage(syncError),
      });

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
