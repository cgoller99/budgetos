import "server-only";

import {
  decryptConnectionAccessToken,
  removePlaidItem,
} from "@/lib/plaid/plaidService";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";

const USER_FINANCE_TABLES = [
  "income_plan_allocation_events",
  "income_plan_paycheck_events",
  "income_plan_allocations",
  "income_plans",
  "allocation_ledger",
  "envelope_balances",
  "bill_splits",
  "transactions",
  "bills",
  "goals",
  "investments",
  "accounts",
  "plaid_recurring_dismissals",
  "notifications",
  "recurring_items",
] as const;

async function deleteUserRows(
  adminSupabase: BuxmeSupabaseClient,
  table: string,
  userId: string,
): Promise<void> {
  const { error } = await adminSupabase.from(table).delete().eq("user_id", userId);

  if (!error) {
    return;
  }

  if (
    error.message.includes("Could not find the table") ||
    error.message.includes("does not exist")
  ) {
    return;
  }

  throw error;
}

async function disconnectPlaidConnections(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
): Promise<number> {
  const { data: connections, error } = await adminSupabase
    .from("bank_connections")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  for (const connection of connections ?? []) {
    try {
      if (
        connection.access_token_encrypted &&
        connection.access_token_iv &&
        connection.access_token_tag
      ) {
        const accessToken = decryptConnectionAccessToken(connection);
        await removePlaidItem(accessToken);
      }
    } catch {
      // Best-effort Plaid cleanup — local data reset continues regardless.
    }
  }

  const { error: deleteError } = await adminSupabase
    .from("bank_connections")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    throw deleteError;
  }

  return connections?.length ?? 0;
}

export type FactoryResetSummary = {
  plaidConnectionsRemoved: number;
  tablesCleared: string[];
};

export async function factoryResetUserFinance(input: {
  adminSupabase: BuxmeSupabaseClient;
  userId: string;
}): Promise<FactoryResetSummary> {
  const { adminSupabase, userId } = input;
  const now = new Date().toISOString();

  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    throw new Error("User not found.");
  }

  const plaidConnectionsRemoved = await disconnectPlaidConnections(
    adminSupabase,
    userId,
  );

  const tablesCleared: string[] = [];

  for (const table of USER_FINANCE_TABLES) {
    await deleteUserRows(adminSupabase, table, userId);
    tablesCleared.push(table);
  }

  const { error: profileUpdateError } = await adminSupabase
    .from("profiles")
    .update({
      onboarding_complete: false,
      onboarding_mode: "fresh",
      demo_profile_id: null,
      updated_at: now,
    })
    .eq("id", userId);

  if (profileUpdateError) {
    throw profileUpdateError;
  }

  return {
    plaidConnectionsRemoved,
    tablesCleared,
  };
}
