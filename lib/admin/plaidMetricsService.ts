import "server-only";

import { isPlaidEnabled } from "@/lib/plaid/config";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";

import type { AdminPlaidMetrics } from "@/lib/admin/types";

export type { AdminPlaidMetrics } from "@/lib/admin/types";

export async function getAdminPlaidMetrics(
  adminSupabase: BuxmeSupabaseClient,
): Promise<AdminPlaidMetrics> {
  if (!isPlaidEnabled()) {
    return {
      available: false,
      connectedInstitutions: 0,
      connectedAccounts: 0,
      syncSuccessRate: 0,
      failedSyncs: 0,
      lastSync: null,
      averageSyncTimeMs: null,
    };
  }

  const [{ data: connections, error: connectionsError }, { count: accountCount, error: accountsError }] =
    await Promise.all([
      adminSupabase
        .from("bank_connections")
        .select("id, institution_id, status, error_code, last_synced_at, updated_at"),
      adminSupabase
        .from("accounts")
        .select("*", { count: "exact", head: true })
        .not("bank_connection_id", "is", null),
    ]);

  if (connectionsError) {
    throw connectionsError;
  }

  if (accountsError) {
    throw accountsError;
  }

  const rows = connections ?? [];
  const institutions = new Set(
    rows.map((row) => row.institution_id).filter(Boolean) as string[],
  );
  const healthy = rows.filter((row) => row.status === "connected" && !row.error_code).length;
  const failedSyncs = rows.filter((row) => Boolean(row.error_code)).length;
  const syncSuccessRate =
    rows.length === 0 ? 0 : Number(((healthy / rows.length) * 100).toFixed(1));

  const lastSync = rows
    .map((row) => row.last_synced_at)
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;

  const durations = rows
    .filter((row) => row.last_synced_at && row.updated_at)
    .map((row) =>
      Math.max(
        0,
        new Date(row.updated_at).getTime() - new Date(row.last_synced_at!).getTime(),
      ),
    );

  const averageSyncTimeMs =
    durations.length === 0
      ? null
      : Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length);

  return {
    available: true,
    connectedInstitutions: institutions.size,
    connectedAccounts: accountCount ?? 0,
    syncSuccessRate,
    failedSyncs,
    lastSync,
    averageSyncTimeMs,
  };
}
