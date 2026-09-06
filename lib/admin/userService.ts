import "server-only";

import { isFounderEmail } from "@/lib/founder/emails";
import { logAdminEvent } from "@/lib/admin/eventLog";
import {
  adminActionToEntitlementPlan,
  buildClearAppleIapBindingUpdate,
  buildEntitlementProfileUpdate,
  buildEntitlementSnapshot,
  entitlementPlanLabel,
  profileHasAppleIapBinding,
  type AdminEntitlementSnapshot,
} from "@/lib/admin/entitlementAdmin";
import { factoryResetUserFinance } from "@/lib/admin/factoryResetService";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

import type { AdminUserAction, AdminUserSummary } from "@/lib/admin/types";

export type { AdminUserAction, AdminUserSummary } from "@/lib/admin/types";

export type AdminUserDetail = AdminUserSummary & {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  householdName: string | null;
};

const PROFILE_ENTITLEMENT_SELECT =
  "id, email, full_name, subscription_plan, subscription_status, subscription_provider, subscription_current_period_end, created_at, last_active_at, is_disabled, admin_founder_granted, household_id, stripe_customer_id, stripe_subscription_id, apple_product_id, apple_original_transaction_id, apple_transaction_id, apple_environment";

type ProfileEntitlementRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  subscription_plan: string;
  subscription_status: string;
  subscription_provider: string | null;
  created_at: string;
  last_active_at: string | null;
  is_disabled: boolean;
  admin_founder_granted: boolean;
  household_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  apple_product_id: string | null;
  apple_original_transaction_id: string | null;
  apple_transaction_id: string | null;
  apple_environment: string | null;
};

function toSummary(
  profile: ProfileEntitlementRow,
  counts: {
    goalCount: number;
    connectedAccountCount: number;
    feedbackCount: number;
    lastSignInAt: string | null;
  },
): AdminUserSummary {
  const isEnvFounder = isFounderEmail(profile.email);
  const snapshot = buildEntitlementSnapshot({
    subscriptionPlan: profile.subscription_plan,
    subscriptionStatus: profile.subscription_status,
    subscriptionProvider: profile.subscription_provider,
    adminFounderGranted: profile.admin_founder_granted,
    isEnvFounder,
    stripeSubscriptionId: profile.stripe_subscription_id,
    appleOriginalTransactionId: profile.apple_original_transaction_id,
    appleProductId: profile.apple_product_id,
  });

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    subscriptionPlan: profile.subscription_plan,
    subscriptionStatus: profile.subscription_status,
    subscriptionProvider: snapshot.subscriptionProvider,
    effectivePlan: snapshot.effectivePlan,
    entitlementSource: snapshot.entitlementSource,
    hasExternalSubscriptionRisk: snapshot.hasExternalSubscriptionRisk,
    appleProductId: profile.apple_product_id,
    appleOriginalTransactionId: profile.apple_original_transaction_id,
    appleTransactionId: profile.apple_transaction_id,
    appleEnvironment: profile.apple_environment,
    joinedAt: profile.created_at,
    lastActiveAt: profile.last_active_at,
    isDisabled: profile.is_disabled,
    adminFounderGranted: profile.admin_founder_granted,
    isEnvFounder,
    householdId: profile.household_id,
    goalCount: counts.goalCount,
    connectedAccountCount: counts.connectedAccountCount,
    feedbackCount: counts.feedbackCount,
    lastSignInAt: counts.lastSignInAt,
  };
}

async function loadEntitlementSnapshot(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
): Promise<AdminEntitlementSnapshot | null> {
  const { data: profile, error } = await adminSupabase
    .from("profiles")
    .select(
      "email, subscription_plan, subscription_status, subscription_provider, admin_founder_granted, stripe_subscription_id, apple_product_id, apple_original_transaction_id",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!profile) {
    return null;
  }

  return buildEntitlementSnapshot({
    subscriptionPlan: profile.subscription_plan,
    subscriptionStatus: profile.subscription_status,
    subscriptionProvider: profile.subscription_provider,
    adminFounderGranted: profile.admin_founder_granted,
    isEnvFounder: isFounderEmail(profile.email),
    stripeSubscriptionId: profile.stripe_subscription_id,
    appleOriginalTransactionId: profile.apple_original_transaction_id,
    appleProductId: profile.apple_product_id,
  });
}

export async function searchAdminUsers(
  adminSupabase: BuxmeSupabaseClient,
  query: string,
): Promise<AdminUserSummary[]> {
  const trimmed = query.trim();
  let profileQuery = adminSupabase
    .from("profiles")
    .select(PROFILE_ENTITLEMENT_SELECT)
    .order("created_at", { ascending: false })
    .limit(25);

  if (trimmed) {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (uuidPattern.test(trimmed)) {
      profileQuery = profileQuery.eq("id", trimmed);
    } else if (/^\d{5,}$/.test(trimmed)) {
      // Support lookup by Apple original / latest transaction id (sandbox ops).
      profileQuery = profileQuery.or(
        `apple_original_transaction_id.eq.${trimmed},apple_transaction_id.eq.${trimmed}`,
      );
    } else {
      profileQuery = profileQuery.or(
        `email.ilike.%${trimmed}%,full_name.ilike.%${trimmed}%`,
      );
    }
  }

  const { data: profiles, error } = await profileQuery;
  if (error) throw error;

  const rows = (profiles ?? []) as ProfileEntitlementRow[];

  return Promise.all(
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

      return toSummary(profile, {
        goalCount: goals.count ?? 0,
        connectedAccountCount: accounts.count ?? 0,
        feedbackCount: feedback.count ?? 0,
        lastSignInAt: authUser.data.user?.last_sign_in_at ?? null,
      });
    }),
  );
}

export async function getAdminUserDetail(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
): Promise<AdminUserDetail | null> {
  const { data: profile, error } = await adminSupabase
    .from("profiles")
    .select(PROFILE_ENTITLEMENT_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!profile) return null;

  const [summary] = await searchAdminUsers(adminSupabase, profile.id);
  if (!summary) return null;

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

  if (
    actor.id === userId &&
    (action === "disable_user" || action === "delete_user")
  ) {
    throw new Error("You cannot disable or delete your own account.");
  }

  const now = new Date().toISOString();
  const entitlementPlan = adminActionToEntitlementPlan(action);

  if (entitlementPlan) {
    const beforeSnapshot = await loadEntitlementSnapshot(adminSupabase, userId);
    if (!beforeSnapshot) {
      throw new Error("User not found.");
    }

    const { error } = await adminSupabase
      .from("profiles")
      .update(buildEntitlementProfileUpdate(entitlementPlan, now))
      .eq("id", userId);

    if (error) throw error;

    const afterSnapshot = await loadEntitlementSnapshot(adminSupabase, userId);

    await logAdminEvent(adminSupabase, {
      eventType: "auth",
      message: `Admin set entitlement for user ${userId} from ${entitlementPlanLabel(beforeSnapshot.effectivePlan)} to ${entitlementPlanLabel(entitlementPlan)}`,
      metadata: {
        action,
        userId,
        actorId: actor.id,
        actorEmail: actor.email ?? null,
        oldPlan: beforeSnapshot.effectivePlan,
        newPlan: entitlementPlan,
        oldSource: beforeSnapshot.entitlementSource,
        newSource: afterSnapshot?.entitlementSource ?? null,
        hadExternalSubscriptionRisk: beforeSnapshot.hasExternalSubscriptionRisk,
        timestamp: now,
      },
      userId,
    });
    return;
  }

  if (action === "clear_apple_iap_binding") {
    const { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .select(
        "id, email, subscription_plan, subscription_status, subscription_provider, apple_product_id, apple_original_transaction_id, apple_transaction_id, apple_environment, stripe_subscription_id",
      )
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      throw new Error("User not found.");
    }

    const beforeBinding = {
      appleProductId: profile.apple_product_id,
      appleOriginalTransactionId: profile.apple_original_transaction_id,
      appleTransactionId: profile.apple_transaction_id,
      appleEnvironment: profile.apple_environment,
      subscriptionProvider: profile.subscription_provider,
      subscriptionPlan: profile.subscription_plan,
      subscriptionStatus: profile.subscription_status,
    };

    if (
      !profileHasAppleIapBinding({
        appleOriginalTransactionId: profile.apple_original_transaction_id,
        appleTransactionId: profile.apple_transaction_id,
        appleProductId: profile.apple_product_id,
        appleEnvironment: profile.apple_environment,
        subscriptionProvider: profile.subscription_provider,
      })
    ) {
      throw new Error(
        "This user has no stored Apple IAP binding to clear (no apple_* identifiers and provider is not apple).",
      );
    }

    const { error: updateError } = await adminSupabase
      .from("profiles")
      .update(buildClearAppleIapBindingUpdate(now))
      .eq("id", userId);

    if (updateError) throw updateError;

    await logAdminEvent(adminSupabase, {
      eventType: "auth",
      message: `Admin cleared Apple IAP binding for user ${userId} (${profile.email ?? "no-email"})`,
      metadata: {
        action,
        userId,
        actorId: actor.id,
        actorEmail: actor.email ?? null,
        supportOnly: true,
        before: beforeBinding,
        after: {
          appleProductId: null,
          appleOriginalTransactionId: null,
          appleTransactionId: null,
          appleEnvironment: null,
          subscriptionProvider: "none",
          subscriptionPlan: "free",
          subscriptionStatus: "none",
        },
        stripeSubscriptionIdPreserved: profile.stripe_subscription_id,
        note: "Local Apple ownership columns cleared only. Auth user preserved. Remote Apple/Stripe subscriptions were not cancelled or modified.",
        timestamp: now,
      },
      userId,
    });
    return;
  }

  switch (action) {
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
    case "reset_finance": {
      const summary = await factoryResetUserFinance({
        adminSupabase,
        userId,
      });
      await logAdminEvent(adminSupabase, {
        eventType: "auth",
        message: `Admin factory reset finance for user ${userId}`,
        metadata: {
          action,
          userId,
          actorId: actor.id,
          summary,
          timestamp: now,
        },
        userId,
      });
      return;
    }
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
    metadata: { action, userId, actorId: actor.id, timestamp: now },
    userId,
  });
}
