import "server-only";

import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import { resolveBetaStatusForSignup } from "@/lib/beta/access.server";

export type BetaRegistrationResult = {
  betaStatus: "pending" | "approved" | "rejected";
  skipped: boolean;
};

/**
 * Assign beta_status after signup or email verification using admin policy rules.
 * Idempotent for approved users; never overrides an admin rejection.
 */
export async function finalizeBetaRegistrationForUser(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  email: string,
): Promise<BetaRegistrationResult> {
  const normalizedEmail = email.trim();

  if (!normalizedEmail) {
    throw new Error("Email is required for beta registration.");
  }

  const { data: profile, error: profileError } = await adminSupabase
    .from("profiles")
    .select("beta_status")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (profile?.beta_status === "rejected") {
    return { betaStatus: "rejected", skipped: true };
  }

  const betaStatus = await resolveBetaStatusForSignup(adminSupabase, normalizedEmail);

  const { error: updateError } = await adminSupabase
    .from("profiles")
    .update({ beta_status: betaStatus, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (updateError) {
    throw updateError;
  }

  return { betaStatus, skipped: false };
}
