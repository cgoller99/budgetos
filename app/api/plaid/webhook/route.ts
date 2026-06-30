import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncPlaidForUser } from "@/lib/plaid/syncService";
import { BankConnectionsRepository } from "@/lib/supabase/repositories/bankConnectionsRepository";

type PlaidWebhookBody = {
  webhook_type?: string;
  webhook_code?: string;
  item_id?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PlaidWebhookBody;
    const itemId = body.item_id?.trim();

    if (!itemId) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const supabase = await createSupabaseServerClient();
    const repository = new BankConnectionsRepository(supabase);
    const { data: connections, error } = await supabase
      .from("bank_connections")
      .select("*")
      .eq("external_item_id", itemId)
      .neq("status", "disconnected");

    if (error) {
      throw error;
    }

    const connection = connections?.[0];

    if (!connection) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    if (
      body.webhook_type === "TRANSACTIONS" &&
      (body.webhook_code === "SYNC_UPDATES_AVAILABLE" ||
        body.webhook_code === "DEFAULT_UPDATE" ||
        body.webhook_code === "INITIAL_UPDATE" ||
        body.webhook_code === "HISTORICAL_UPDATE")
    ) {
      await syncPlaidForUser({
        supabase,
        userId: connection.user_id,
        connectionId: connection.id,
      });
    }

    if (
      body.webhook_type === "ITEM" &&
      (body.webhook_code === "ERROR" || body.webhook_code === "PENDING_EXPIRATION")
    ) {
      await repository.markConnectionSynced({
        connectionId: connection.id,
        userId: connection.user_id,
        transactionsCursor: connection.transactions_cursor,
        status: "error",
        errorCode: body.webhook_code,
        errorMessage: "Bank connection requires re-authentication.",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[plaid/webhook] Failed to process webhook", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
