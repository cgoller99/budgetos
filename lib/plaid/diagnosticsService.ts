import "server-only";

import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import { BankConnectionsRepository } from "@/lib/supabase/repositories/bankConnectionsRepository";
import type { PlaidUserDiagnostics } from "@/lib/plaid/types";

export async function getPlaidUserDiagnostics(params: {
  supabase: BuxmeSupabaseClient;
  userId: string;
}): Promise<PlaidUserDiagnostics> {
  const repository = new BankConnectionsRepository(params.supabase);
  const connections = await repository.listConnections(params.userId);
  const activeConnections = connections.filter(
    (connection) => connection.status !== "disconnected",
  );

  const items: PlaidUserDiagnostics["items"] = [];

  for (const connection of activeConnections) {
    const linkedAccounts = await repository.listLinkedAccounts(params.userId);
    const connectionAccounts = linkedAccounts.filter(
      (account) => account.bank_connection_id === connection.id,
    );
    const transactionCounts = await repository.countTransactionsByAccountIds(
      params.userId,
      connectionAccounts.map((account) => account.id),
    );

    items.push({
      connectionId: connection.id,
      institutionName: connection.institution_name,
      status: connection.status,
      errorCode: connection.error_code,
      errorMessage: connection.error_message,
      lastSyncedAt: connection.last_synced_at,
      accounts: connectionAccounts.map((account) => ({
        id: account.id,
        name: account.name,
        recordKind: account.record_kind,
        type: account.type,
        lastFour: account.last_four,
        balance: Number(account.balance),
        institution: account.institution,
        transactionCount: transactionCounts.get(account.id) ?? 0,
      })),
    });
  }

  return {
    ok: true,
    connections: activeConnections.length,
    items,
  };
}
