import type { BudgetOsSupabaseClient } from "@/lib/supabase/client";

export type HouseholdInvitePreview = {
  id: string;
  householdName: string;
  inviteEmail: string;
  expiresAt: string;
};

export async function loadHouseholdInvitePreview(
  supabase: BudgetOsSupabaseClient,
  token: string,
): Promise<HouseholdInvitePreview | null> {
  const { data, error } = await supabase.rpc("get_household_invite_by_token", {
    p_token: token,
  });

  if (error) {
    throw error;
  }

  if (!data || typeof data !== "object") {
    return null;
  }

  const preview = data as Record<string, unknown>;

  if (
    typeof preview.id !== "string" ||
    typeof preview.household_name !== "string" ||
    typeof preview.invite_email !== "string" ||
    typeof preview.expires_at !== "string"
  ) {
    return null;
  }

  return {
    id: preview.id,
    householdName: preview.household_name,
    inviteEmail: preview.invite_email,
    expiresAt: preview.expires_at,
  };
}
