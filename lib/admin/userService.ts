import "server-only";

import { isFounderEmail } from "@/lib/founder/emails";
import { logAdminEvent } from "@/lib/admin/eventLog";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

import type {
  AdminUserAction,
  AdminUserSummary,
} from "@/lib/admin/types";

export type { AdminUserAction, AdminUserSummary } from "@/lib/admin/types";

export type AdminUserDetail = AdminUserSummary & {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  householdName: string | null;
};

export async function searchAdminUsers(
  adminSupabase: BuxmeSupabaseClient,
  query: string,
): Promise<AdminUserSummary[]> {
  const trimmed = query.trim();
  let profileQuery = adminSupabase
    .from("profiles")
    .select(
      "id, email, full_name, subscription_plan, subscription_status, created_at, last_active_at, is_disabled, admin_founder_granted, household_id",
    )
    .order("created_at", { ascending: false })
    .limit(25);

  if (trimmed) {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (uuidPattern.test(trimmed)) {
      profileQuery = profileQuery.eq("id", trimmed);
    } else {
      profileQuery = profileQuery.or(
        `email.ilike.%${trimmed}%,full_name.ilike.%${trimmed}%`,
      );
    }
  }

  const { data: profiles, error } = await profileQuery;

  if (error) {
    throw error;
  }

  const rows = profiles ?? [];
  const summaries = await Promise.all(
    rows.map(async (profile) => {
      const [goals, accounts, feedback, authUser] = await Promise.all([
        adminSupabase
          .from("goals")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.id),
        adminSupabase
          .from("accounts")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.id)
          .not("bank_connection_id", "is", null),
        adminSupabase
          .from("admin_feedback_reports")
          .select("*", { count: "exact", head: true })
          .eq("user_id", profile.id),
        adminSupabase.auth.admin.getUserById(profile.id),
      ]);

      return {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        subscriptionPlan: profile.subscription_plan,
        subscriptionStatus: profile.subscription_status,
        joinedAt: profile.created_at,
        lastActiveAt: profile.last_active_at,
        isDisabled: profile.is_disabled,
        adminFounderGranted: profile.admin_founder_granted,
        isEnvFounder: isFounderEmail(profile.email),
        householdId: profile.household_id,
        goalCount: goals.count ?? 0,
        connectedAccountCount: accounts.count ?? 0,
        feedbackCount: feedback.count ?? 0,
        lastSignInAt: authUser.data.user?.last_sign_in_at ?? null,
      } satisfies AdminUserSummary;
    }),
  );

  return summaries;
}

export async function getAdminUserDetail(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
): Promise<AdminUserDetail | null> {
  const { data: profile, error } = await adminSupabase
    .from("profiles")
    .select(
      "id, email, full_name, subscription_plan, subscription_status, created_at, last_active_at, is_disabled, admin_founder_granted, household_id, stripe_customer_id, stripe_subscription_id",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!profile) {
    return null;
  }

  const [summary] = await searchAdminUsers(adminSupabase, profile.id);
  let householdName: string | null = null;

  if (profile.household_id) {
    const { data: household } = await adminSupabase
      .from("households")
      .select("name")
      .eq("id", profile.household_id)
      .maybeSingle();
    householdName = household?.name ?? null;
  }

  return {
    ...summary,
    stripeCustomerId: profile.stripe_customer_id,
    stripeSubscriptionId: profile.stripe_subscription_id,
    householdName,
  };
}

export async function performAdminUserAction(input: {
  adminSupabase: BuxmeSupabaseClient;
  actor: User;
  userId: string;
  action: AdminUserAction;
}): Promise<void> {
  const { adminSupabase, actor, userId, action } = input;

  if (actor.id === userId && (action === "disable_user" || action === "delete_user")) {
    throw new Error("You cannot disable or delete your own account.");
  }

  const now = new Date().toISOString();

  switch (action) {
    case "grant_founder":
      await adminSupabase
        .from("profiles")
        .update({ admin_founder_granted: true, updated_at: now })
        .eq("id", userId);
      break;
    case "grant_pro":
      await adminSupabase
        .from("profiles")
        .update({
          subscription_plan: "pro",
          subscription_status: "active",
          updated_at: now,
        })
        .eq("id", userId);
      break;
    case "grant_pro_plus":
      await adminSupabase
        .from("profiles")
        .update({
          subscription_plan: "pro_plus",
          subscription_status: "active",
          updated_at: now,
        })
        .eq("id", userId);
      break;
    case "remove_subscription":
      await adminSupabase
        .from("profiles")
        .update({
          subscription_plan: "free",
          subscription_status: "none",
          stripe_subscription_id: null,
          subscription_current_period_end: null,
          admin_founder_granted: false,
          updated_at: now,
        })
        .eq("id", userId);
      break;
    case "disable_user":
      await adminSupabase
        .from("profiles")
        .update({ is_disabled: true, updated_at: now })
        .eq("id", userId);
      await adminSupabase.auth.admin.updateUserById(userId, {
        ban_duration: "876000h",
      });
      break;
    case "enable_user":
      await adminSupabase
        .from("profiles")
        .update({ is_disabled: false, updated_at: now })
        .eq("id", userId);
      await adminSupabase.auth.admin.updateUserById(userId, {
        ban_duration: "none",
      });
      break;
    case "delete_user":
      await adminSupabase.from("profiles").delete().eq("id", userId);
      await adminSupabase.auth.admin.deleteUser(userId);
      break;
    default:
      throw new Error("Unsupported admin action.");
  }

  await logAdminEvent(adminSupabase, {
    eventType: "auth",
    message: `Admin action ${action} on user ${userId}`,
    metadata: { action, userId, actorId: actor.id },
    userId,
  });
}
