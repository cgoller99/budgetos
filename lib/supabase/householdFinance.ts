import type { BudgetOsSupabaseClient } from "@/lib/supabase/client";

export async function resolveUserHouseholdId(
  supabase: BudgetOsSupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("household_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (profile?.household_id) {
    return profile.household_id;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw membershipError;
  }

  return membership?.household_id ?? null;
}

export function householdFinanceOrFilter(
  userId: string,
  householdId: string | null,
): string | null {
  if (!householdId) {
    return null;
  }

  return `user_id.eq.${userId},household_id.eq.${householdId}`;
}

export async function backfillHouseholdFinanceRows(
  supabase: BudgetOsSupabaseClient,
  userId: string,
  householdId: string,
): Promise<void> {
  const updates = [
    supabase
      .from("accounts")
      .update({ household_id: householdId })
      .eq("user_id", userId)
      .is("household_id", null),
    supabase
      .from("bills")
      .update({ household_id: householdId })
      .eq("user_id", userId)
      .is("household_id", null),
    supabase
      .from("goals")
      .update({ household_id: householdId })
      .eq("user_id", userId)
      .is("household_id", null),
    supabase
      .from("transactions")
      .update({ household_id: householdId })
      .eq("user_id", userId)
      .is("household_id", null),
    supabase
      .from("investments")
      .update({ household_id: householdId })
      .eq("user_id", userId)
      .is("household_id", null),
  ];

  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error)?.error;

  if (failed && !failed.message.includes("household_id")) {
    throw failed;
  }
}
