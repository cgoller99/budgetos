#!/usr/bin/env node
/**
 * Factory-reset a Buxme account by email.
 * Keeps auth email + password. Wipes finance / product data.
 *
 * Usage:
 *   npm run reset:user-account -- --email user@example.com
 *   npm run reset:user-account -- --email user@example.com --dry-run
 */

import { createClient } from "@supabase/supabase-js";

function getArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

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
  "user_release_views",
];

async function deleteUserRows(supabase, table, userId) {
  const { error } = await supabase.from(table).delete().eq("user_id", userId);
  if (!error) return;
  if (
    error.message.includes("Could not find the table") ||
    error.message.includes("does not exist")
  ) {
    return;
  }
  throw error;
}

async function resolveUserId(supabase, email) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, household_id, onboarding_complete")
    .ilike("email", email)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (profile) {
    return { userId: profile.id, profile };
  }

  let page = 1;
  while (page <= 20) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;

    const found = data.users.find((user) => user.email?.toLowerCase() === email);
    if (found) {
      return { userId: found.id, profile: null, authEmail: found.email };
    }

    if (!data.users.length || data.users.length < 200) {
      break;
    }
    page += 1;
  }

  return null;
}

async function resetByUserId(supabase, userId, email) {
  const { data: connections, error: connectionsError } = await supabase
    .from("bank_connections")
    .select("id")
    .eq("user_id", userId);

  if (connectionsError) throw connectionsError;

  const { error: deleteConnectionsError } = await supabase
    .from("bank_connections")
    .delete()
    .eq("user_id", userId);

  if (deleteConnectionsError) throw deleteConnectionsError;

  await supabase.from("household_members").delete().eq("user_id", userId);
  await supabase.from("household_invites").delete().eq("invited_by", userId);

  for (const table of USER_FINANCE_TABLES) {
    await deleteUserRows(supabase, table, userId);
  }

  const now = new Date().toISOString();
  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update({
      onboarding_complete: false,
      onboarding_mode: "fresh",
      demo_profile_id: null,
      household_id: null,
      onboarding_step: 0,
      onboarding_progress: {},
      updated_at: now,
    })
    .eq("id", userId);

  if (profileUpdateError) throw profileUpdateError;

  await supabase.from("admin_event_logs").insert({
    event_type: "auth",
    message: `CLI factory reset finance for user ${email}`,
    metadata: {
      action: "reset_finance",
      userId,
      email,
      plaidConnectionsRemoved: connections?.length ?? 0,
      source: "scripts/reset-user-account.mjs",
    },
    user_id: userId,
  });

  console.log(
    `Reset complete for ${email}. Kept email/password. Removed ${connections?.length ?? 0} bank connection(s).`,
  );
}

async function main() {
  const email = getArg("email")?.trim().toLowerCase();
  const dryRun = hasFlag("dry-run");

  if (!email) {
    console.error(
      "Usage: npm run reset:user-account -- --email user@example.com [--dry-run]",
    );
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const resolved = await resolveUserId(supabase, email);
  if (!resolved) {
    console.error(`No user found for ${email}`);
    process.exit(1);
  }

  if (resolved.profile) {
    console.log(
      `Found profile ${resolved.profile.id} (${resolved.profile.email ?? email}) name=${resolved.profile.full_name ?? "—"} household=${resolved.profile.household_id ?? "none"} onboarding=${resolved.profile.onboarding_complete}`,
    );
  } else {
    console.log(`Found auth user ${resolved.userId} (${resolved.authEmail ?? email})`);
  }

  if (dryRun) {
    console.log("Dry run — no changes made.");
    return;
  }

  await resetByUserId(supabase, resolved.userId, email);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
