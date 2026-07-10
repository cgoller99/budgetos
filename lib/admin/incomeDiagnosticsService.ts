import "server-only";

import { diagnoseIncomeCalculation } from "@/lib/finance/personalIncomeScope";
import { syncPlaidForUser } from "@/lib/plaid/syncService";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import { FinanceService } from "@/lib/supabase/services/financeService";
import { resolveUserHouseholdId } from "@/lib/supabase/householdFinance";

export type AdminIncomeDiagnosticsResult = {
  userId: string;
  email: string | null;
  fullName: string | null;
  householdId: string | null;
  householdMemberCount: number;
  plaidConnectionsSynced: number;
  diagnostics: ReturnType<typeof diagnoseIncomeCalculation>;
};

export async function getAdminIncomeDiagnostics(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
): Promise<AdminIncomeDiagnosticsResult | null> {
  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("id, email, full_name, household_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile) {
    return null;
  }

  const householdId =
    profile.household_id ??
    (await resolveUserHouseholdId(adminSupabase, userId));

  let householdMemberCount = 1;

  if (householdId) {
    const { count, error: memberError } = await adminSupabase
      .from("household_members")
      .select("*", { count: "exact", head: true })
      .eq("household_id", householdId);

    if (!memberError && typeof count === "number" && count > 0) {
      householdMemberCount = count;
    }
  }

  const financeService = new FinanceService(adminSupabase);
  const financeData = await financeService.loadFinanceData(userId);
  const diagnostics = diagnoseIncomeCalculation(financeData);

  return {
    userId,
    email: profile.email,
    fullName: profile.full_name,
    householdId,
    householdMemberCount,
    plaidConnectionsSynced: 0,
    diagnostics,
  };
}

export async function refreshAdminIncomeDiagnostics(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
): Promise<AdminIncomeDiagnosticsResult | null> {
  const financeService = new FinanceService(adminSupabase);
  const financeData = await financeService.loadFinanceData(userId);
  const connections = financeData.bankConnections ?? [];

  let synced = 0;

  for (const connection of connections) {
    if (connection.status === "disconnected") {
      continue;
    }

    try {
      await syncPlaidForUser({
        supabase: adminSupabase,
        userId,
        connectionId: connection.id,
      });
      synced += 1;
    } catch (error) {
      console.error("[admin/income-diagnostics] Plaid sync failed", {
        userId,
        connectionId: connection.id,
        error,
      });
    }
  }

  const result = await getAdminIncomeDiagnostics(adminSupabase, userId);

  if (!result) {
    return null;
  }

  return {
    ...result,
    plaidConnectionsSynced: synced,
  };
}
