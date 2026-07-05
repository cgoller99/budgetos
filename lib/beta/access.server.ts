import "server-only";

import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import { getBetaSettings } from "@/lib/admin/betaService";

export type BetaRegistrationAccess = {
  allowed: boolean;
  inviteOnly: boolean;
  isFull: boolean;
  waitlistEnabled: boolean;
  reason?: "invite_only" | "beta_full";
};

export async function checkBetaRegistrationAccess(
  adminSupabase: BuxmeSupabaseClient,
  email: string,
): Promise<BetaRegistrationAccess> {
  const normalizedEmail = email.trim().toLowerCase();
  const settings = await getBetaSettings(adminSupabase);

  const { count: approvedCount } = await adminSupabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("beta_status", "approved");

  const isFull = Boolean(
    settings.maxBetaUsers && (approvedCount ?? 0) >= settings.maxBetaUsers,
  );

  if (!settings.inviteOnly) {
    if (isFull) {
      return {
        allowed: false,
        inviteOnly: false,
        isFull: true,
        waitlistEnabled: settings.waitlistEnabled,
        reason: "beta_full",
      };
    }

    return {
      allowed: true,
      inviteOnly: false,
      isFull: false,
      waitlistEnabled: settings.waitlistEnabled,
    };
  }

  const { data: waitlistEntry } = await adminSupabase
    .from("beta_waitlist")
    .select("status")
    .ilike("email", normalizedEmail)
    .maybeSingle();

  if (waitlistEntry?.status === "approved") {
    return {
      allowed: true,
      inviteOnly: true,
      isFull,
      waitlistEnabled: settings.waitlistEnabled,
    };
  }

  return {
    allowed: false,
    inviteOnly: true,
    isFull,
    waitlistEnabled: settings.waitlistEnabled,
    reason: "invite_only",
  };
}

export async function resolveBetaStatusForSignup(
  adminSupabase: BuxmeSupabaseClient,
  email: string,
): Promise<"pending" | "approved" | "rejected"> {
  const access = await checkBetaRegistrationAccess(adminSupabase, email);

  if (!access.inviteOnly) {
    return access.isFull ? "pending" : "approved";
  }

  return access.allowed ? "approved" : "pending";
}
