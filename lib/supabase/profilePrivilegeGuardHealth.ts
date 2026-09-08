import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const PROFILE_PRIVILEGE_GUARD_TRIGGER = "guard_profile_privileged_columns";
export const PROFILE_PRIVILEGE_GUARD_APPLY_COMMAND =
  "npm run apply:profile-privilege-guard";

const PROBE_EMAIL = "privilege-probe@buxme.internal";
const PROBE_PASSWORD = "buxme-privilege-probe-7f3a9c!";

const PRIVILEGED_UPDATE_ATTEMPTS: Array<Record<string, unknown>> = [
  { subscription_plan: "pro_plus" },
  { subscription_status: "active" },
  { subscription_provider: "apple" },
  { stripe_customer_id: "cus_privilege_probe" },
  { stripe_subscription_id: "sub_privilege_probe" },
  { apple_product_id: "com.buxme.pro.monthly" },
  { apple_original_transaction_id: "1000000000000000" },
  { admin_founder_granted: true },
  { beta_status: "approved" },
  { is_disabled: true },
];

export type ProfilePrivilegeGuardHealth = {
  checked: boolean;
  triggerExists: boolean | null;
  privilegedUpdatesBlocked: boolean;
  active: boolean;
  error: string | null;
  applyCommand: string;
  protectedColumns: string[];
};

function isPrivilegeBlockedError(message: string | undefined): boolean {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("profile_privilege_escalation_blocked") ||
    normalized.includes("privilege_escalation") ||
    normalized.includes("42501")
  );
}

async function ensureProbeUser(
  admin: ReturnType<typeof createSupabaseAdminClient>,
): Promise<string> {
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = listed.data.users.find(
    (user) => user.email?.toLowerCase() === PROBE_EMAIL,
  );

  if (existing?.id) {
    await admin.auth.admin.updateUserById(existing.id, {
      password: PROBE_PASSWORD,
      email_confirm: true,
      ban_duration: "none",
    });
    return existing.id;
  }

  const created = await admin.auth.admin.createUser({
    email: PROBE_EMAIL,
    password: PROBE_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Privilege Probe" },
  });

  if (created.error || !created.data.user?.id) {
    throw new Error(
      created.error?.message ?? "Unable to create privilege-guard probe user.",
    );
  }

  return created.data.user.id;
}

async function checkTriggerExistsViaRpc(
  admin: ReturnType<typeof createSupabaseAdminClient>,
): Promise<boolean | null> {
  const { data, error } = await admin.rpc("profile_privilege_guard_active");

  if (error) {
    // RPC migration may not be applied yet — fall through to behavioral probe.
    return null;
  }

  return Boolean(data);
}

/**
 * Production-safe privilege guard probe.
 * Uses the service role only on the server; never returns credentials.
 * Proves authenticated users cannot escalate privileged profile columns.
 */
export async function checkProfilePrivilegeGuardHealth(): Promise<ProfilePrivilegeGuardHealth> {
  const protectedColumns = [
    "subscription_plan",
    "subscription_status",
    "subscription_provider",
    "stripe_customer_id",
    "stripe_subscription_id",
    "apple_product_id",
    "apple_original_transaction_id",
    "admin_founder_granted",
    "beta_status",
    "is_disabled",
  ];

  const base: ProfilePrivilegeGuardHealth = {
    checked: false,
    triggerExists: null,
    privilegedUpdatesBlocked: false,
    active: false,
    error: null,
    applyCommand: PROFILE_PRIVILEGE_GUARD_APPLY_COMMAND,
    protectedColumns,
  };

  try {
    const { url, anonKey, isConfigured } = getSupabaseConfig();

    if (!isConfigured || !url || !anonKey) {
      return {
        ...base,
        error:
          "Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).",
      };
    }

    const admin = createSupabaseAdminClient();
    const triggerExists = await checkTriggerExistsViaRpc(admin);
    const userId = await ensureProbeUser(admin);

    // Reset privileged fields via service role so the probe starts from a known free state.
    await admin
      .from("profiles")
      .update({
        subscription_plan: "free",
        subscription_status: "none",
        stripe_customer_id: null,
        stripe_subscription_id: null,
        admin_founder_granted: false,
        beta_status: "pending",
        is_disabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    const userClient = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { error: signInError } = await userClient.auth.signInWithPassword({
      email: PROBE_EMAIL,
      password: PROBE_PASSWORD,
    });

    if (signInError) {
      return {
        ...base,
        checked: true,
        triggerExists,
        error: `Probe sign-in failed: ${signInError.message}`,
      };
    }

    let blockedCount = 0;
    let unexpectedError: string | null = null;

    for (const patch of PRIVILEGED_UPDATE_ATTEMPTS) {
      const { data, error } = await userClient
        .from("profiles")
        .update(patch)
        .eq("id", userId)
        .select("id")
        .maybeSingle();

      if (error && isPrivilegeBlockedError(error.message)) {
        blockedCount += 1;
        continue;
      }

      if (error) {
        // Some PostgREST/RLS setups may surface a generic error — treat as blocked
        // only when zero rows were returned and message suggests permission denial.
        if (
          error.code === "42501" ||
          /permission|policy|forbidden|not allowed/i.test(error.message)
        ) {
          blockedCount += 1;
          continue;
        }

        unexpectedError = error.message;
        break;
      }

      if (data) {
        unexpectedError = `Authenticated user was able to update privileged fields: ${Object.keys(patch).join(", ")}`;
        // Revert with service role before failing.
        await admin
          .from("profiles")
          .update({
            subscription_plan: "free",
            subscription_status: "none",
            stripe_customer_id: null,
            stripe_subscription_id: null,
            admin_founder_granted: false,
            beta_status: "pending",
            is_disabled: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);
        break;
      }

      // Update returned no row and no error — treat as blocked (0-row update).
      blockedCount += 1;
    }

    await userClient.auth.signOut();

    const privilegedUpdatesBlocked =
      blockedCount === PRIVILEGED_UPDATE_ATTEMPTS.length && !unexpectedError;

    return {
      checked: true,
      triggerExists,
      privilegedUpdatesBlocked,
      // Behavioral proof is authoritative — never claim active from migration file alone.
      active: privilegedUpdatesBlocked,
      error: unexpectedError
        ? `${unexpectedError} Apply with: ${PROFILE_PRIVILEGE_GUARD_APPLY_COMMAND}`
        : privilegedUpdatesBlocked
          ? null
          : `Profile privilege guard is not active. Apply with: ${PROFILE_PRIVILEGE_GUARD_APPLY_COMMAND}`,
      applyCommand: PROFILE_PRIVILEGE_GUARD_APPLY_COMMAND,
      protectedColumns,
    };
  } catch (error) {
    return {
      ...base,
      checked: true,
      error: `${
        error instanceof Error ? error.message : String(error)
      } Apply with: ${PROFILE_PRIVILEGE_GUARD_APPLY_COMMAND}`,
    };
  }
}
