import "server-only";

import { syncPlaidForUser } from "@/lib/plaid/syncService";
import type { PlaidWebhookEvent } from "@/lib/plaid/webhookEvents";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import { BankConnectionsRepository } from "@/lib/supabase/repositories/bankConnectionsRepository";

export type PlaidWebhookProcessResult = {
  status: "processed" | "ignored" | "not_found";
  webhookType?: string;
  webhookCode?: string;
  connectionId?: string;
  syncTriggered?: boolean;
};

export async function processPlaidWebhookEvent(params: {
  event: PlaidWebhookEvent;
  supabase: BuxmeSupabaseClient;
}): Promise<PlaidWebhookProcessResult> {
  const { event, supabase } = params;
  const itemId = event.item_id?.trim();
  const webhookType = event.webhook_type?.trim();
  const webhookCode = event.webhook_code?.trim();

  if (!itemId || !webhookType || !webhookCode) {
    return { status: "ignored", webhookType, webhookCode };
  }

  const repository = new BankConnectionsRepository(supabase);
  const { data: connections, error } = await supabase
    .from("bank_connections")
    .select("*")
    .eq("external_item_id", itemId)
    .neq("status", "disconnected");

  if (error) {
    throw error;
  }

  if (!connections || connections.length === 0) {
    return {
      status: "not_found",
      webhookType,
      webhookCode,
    };
  }

  if (connections.length > 1) {
    console.error("[plaid/webhook] multiple connections for item_id", {
      itemId,
      connectionIds: connections.map((row) => row.id),
      userIds: connections.map((row) => row.user_id),
    });
    return {
      status: "ignored",
      webhookType,
      webhookCode,
    };
  }

  const connection = connections[0];

  const shouldSync =
    (webhookType === "TRANSACTIONS" &&
      (webhookCode === "SYNC_UPDATES_AVAILABLE" ||
        webhookCode === "DEFAULT_UPDATE" ||
        webhookCode === "INITIAL_UPDATE" ||
        webhookCode === "HISTORICAL_UPDATE" ||
        webhookCode === "TRANSACTIONS_REMOVED")) ||
    (webhookType === "HOLDINGS" && webhookCode === "DEFAULT_UPDATE") ||
    (webhookType === "LIABILITIES" && webhookCode === "DEFAULT_UPDATE") ||
    (webhookType === "INVESTMENTS_TRANSACTIONS" &&
      webhookCode === "DEFAULT_UPDATE") ||
    (webhookType === "ITEM" && webhookCode === "NEW_ACCOUNTS_AVAILABLE");

  if (shouldSync) {
    await syncPlaidForUser({
      supabase,
      userId: connection.user_id,
      connectionId: connection.id,
    });

    return {
      status: "processed",
      webhookType,
      webhookCode,
      connectionId: connection.id,
      syncTriggered: true,
    };
  }

  if (
    webhookType === "ITEM" &&
    (webhookCode === "ERROR" ||
      webhookCode === "PENDING_EXPIRATION" ||
      webhookCode === "USER_PERMISSION_REVOKED")
  ) {
    await repository.markConnectionSynced({
      connectionId: connection.id,
      userId: connection.user_id,
      transactionsCursor: connection.transactions_cursor,
      status: "error",
      errorCode: webhookCode,
      errorMessage:
        webhookCode === "USER_PERMISSION_REVOKED"
          ? "Bank access was revoked. Reconnect to continue syncing."
          : "Bank connection requires re-authentication.",
    });

    return {
      status: "processed",
      webhookType,
      webhookCode,
      connectionId: connection.id,
      syncTriggered: false,
    };
  }

  return {
    status: "ignored",
    webhookType,
    webhookCode,
    connectionId: connection.id,
  };
}
