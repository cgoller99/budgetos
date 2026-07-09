#!/usr/bin/env node
/**
 * Verify account preference columns and mapper round-trip.
 * Usage: node --env-file=.env.local scripts/verify-account-preferences.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

function report(ok, label, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `: ${detail}` : ""}`);
  return ok;
}

async function checkMigrationColumns() {
  const response = await fetch(
    `${url}/rest/v1/accounts?select=nickname,icon,color,include_in_net_worth,include_in_safe_to_spend,is_hidden,archived_at&limit=0`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    },
  );

  return report(response.ok, "Preference columns queryable", `HTTP ${response.status}`);
}

async function checkProductionHealth() {
  const response = await fetch("https://buxme.co/api/health/supabase");
  const body = await response.json().catch(() => ({}));
  let ok = report(
    body.accountManagementMigrationApplied === true,
    "Production accountManagementMigrationApplied",
    String(body.accountManagementMigrationApplied),
  );

  if ("accountPreferencesPersistenceVerified" in body) {
    ok =
      report(
        body.accountPreferencesPersistenceVerified === true,
        "Production accountPreferencesPersistenceVerified",
        body.accountPreferencesPersistenceError ?? "passed",
      ) && ok;
  }

  return ok;
}

async function checkDbRoundTrip() {
  if (!serviceRoleKey) {
    report(false, "DB round-trip persistence test", "SUPABASE_SERVICE_ROLE_KEY not set locally");
    return false;
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: owner } = await admin.from("profiles").select("id").limit(1).maybeSingle();
  if (!owner?.id) {
    return report(false, "DB round-trip persistence test", "no profile found");
  }

  const testId = crypto.randomUUID();
  const probe = {
    nickname: "Verify Nickname",
    icon: "🎯",
    color: "violet",
    include_in_net_worth: false,
    include_in_safe_to_spend: false,
    is_hidden: true,
    archived_at: new Date().toISOString(),
  };

  const { error: insertError } = await admin.from("accounts").insert({
    id: testId,
    user_id: owner.id,
    record_kind: "account",
    name: "__verify_pref__",
    institution: "Verify",
    type: "checking",
    balance: 0,
    monthly_change: 0,
    ...probe,
  });

  if (insertError) {
    return report(false, "DB round-trip persistence test", insertError.message);
  }

  const { data: row, error: readError } = await admin
    .from("accounts")
    .select("nickname,icon,color,include_in_net_worth,include_in_safe_to_spend,is_hidden,archived_at")
    .eq("id", testId)
    .single();

  await admin.from("accounts").delete().eq("id", testId);

  if (readError || !row) {
    return report(false, "DB round-trip persistence test", readError?.message ?? "read failed");
  }

  const passed =
    row.nickname === probe.nickname &&
    row.icon === probe.icon &&
    row.color === probe.color &&
    row.include_in_net_worth === probe.include_in_net_worth &&
    row.include_in_safe_to_spend === probe.include_in_safe_to_spend &&
    row.is_hidden === probe.is_hidden &&
    row.archived_at !== null;

  return report(passed, "DB round-trip persistence test", passed ? "values match" : "mismatch");
}

async function main() {
  console.log("Account preferences verification\n");

  if (!url || !anonKey) {
    console.error("Missing Supabase public env vars.");
    process.exit(1);
  }

  let ok = true;
  ok = (await checkMigrationColumns()) && ok;
  ok = (await checkProductionHealth()) && ok;
  ok = (await checkDbRoundTrip()) && ok;

  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
