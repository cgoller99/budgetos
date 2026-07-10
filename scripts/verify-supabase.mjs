#!/usr/bin/env node
/**
 * Verifies Supabase env, client init, table presence, and basic API connectivity.
 * Usage: npm run verify:supabase
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { hydrateProcessEnvFromFile } from "./lib/env-utils.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");
const MIGRATIONS_DIR = path.join(ROOT, "supabase/migrations");

const REQUIRED_TABLES = [
  "profiles",
  "accounts",
  "transactions",
  "bills",
  "bill_splits",
  "goals",
  "investments",
  "recurring_items",
  "notifications",
  "households",
  "household_members",
  "household_invites",
  "bank_connections",
  "plaid_recurring_dismissals",
  "income_plans",
  "income_plan_allocations",
  "income_plan_paycheck_events",
  "income_plan_allocation_events",
  "envelope_balances",
  "allocation_ledger",
  "admin_feedback_reports",
  "admin_event_logs",
  "beta_settings",
  "beta_waitlist",
  "app_releases",
  "app_release_changes",
  "user_release_views",
];

const REQUIRED_PROFILE_COLUMNS = ["household_id"];

const TABLE_SELECT_COLUMN = {
  household_members: "household_id,user_id",
  user_release_views: "user_id,release_id",
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values = {};

  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const index = trimmed.indexOf("=");

    if (index === -1) {
      continue;
    }

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function report(title, ok, detail = "") {
  const icon = ok ? "✓" : "✗";
  console.log(`${icon} ${title}${detail ? `: ${detail}` : ""}`);
  return ok;
}

async function main() {
  console.log("Buxme Supabase verification\n");

  hydrateProcessEnvFromFile();

  let allOk = true;

  allOk = report("supabase/schema.sql present", fs.existsSync(path.join(ROOT, "supabase/schema.sql"))) && allOk;

  const migrationFiles = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    allOk = report(`Migration present (${file})`, true) && allOk;
  }

  console.log("");

  const fileEnv = loadEnvFile(ENV_PATH);
  const rawUrl = (
    fileEnv.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    ""
  ).trim();
  const url = rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  const anonKey = (
    fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  ).trim();
  const serviceRoleKey = (
    fileEnv.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    ""
  ).trim();

  allOk = report(".env.local exists", fs.existsSync(ENV_PATH)) && allOk;
  allOk = report("NEXT_PUBLIC_SUPABASE_URL is set", Boolean(url), url ? `${url.length} chars` : "empty") && allOk;
  allOk =
    report(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is set",
      Boolean(anonKey),
      anonKey ? `${anonKey.length} chars` : "empty",
    ) && allOk;
  allOk =
    report(
      "SUPABASE_SERVICE_ROLE_KEY is set",
      Boolean(serviceRoleKey),
      serviceRoleKey ? `${serviceRoleKey.length} chars` : "empty",
    ) && allOk;

  if (!url || !anonKey) {
    console.log("\nCannot test live connection until Supabase env vars are filled.");
    console.log("Fix: vercel env pull .env.local --environment=production");
    process.exit(1);
  }

  allOk = report("URL format looks valid", /^https:\/\/.+\.supabase\.co\/?$/.test(url)) && allOk;

  let client;

  try {
    client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    allOk = report("Supabase client initializes", true) && allOk;
  } catch (error) {
    allOk = report("Supabase client initializes", false, error instanceof Error ? error.message : String(error)) && allOk;
    process.exit(1);
  }

  try {
    const healthResponse = await fetch(`${url.replace(/\/$/, "")}/auth/v1/health`, {
      headers: { apikey: anonKey },
    });
    allOk =
      report(
        "REST API reachable",
        healthResponse.ok,
        `HTTP ${healthResponse.status}`,
      ) && allOk;
  } catch (error) {
    allOk =
      report(
        "REST API reachable",
        false,
        error instanceof Error ? error.message : String(error),
      ) && allOk;
  }

  const { error: authError } = await client.auth.getSession();
  allOk =
    report(
      "Auth API reachable",
      !authError,
      authError?.message ?? "session check ok",
    ) && allOk;

  console.log("\nTable checks (via PostgREST):");

  const missingTables = [];
  const rlsProtectedTables = [];
  const restBase = `${url.replace(/\/$/, "")}/rest/v1`;
  const restHeaders = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };

  async function tableExists(table) {
    const selectColumn = TABLE_SELECT_COLUMN[table] ?? "id";
    const response = await fetch(
      `${restBase}/${table}?select=${selectColumn}&limit=0`,
      {
        method: "GET",
        headers: restHeaders,
      },
    );

    if (response.status === 404) {
      return { exists: false, reason: "not in schema cache" };
    }

    if (response.ok) {
      return { exists: true };
    }

    const body = await response.text();
    if (body.includes("PGRST205") || body.toLowerCase().includes("could not find")) {
      return { exists: false, reason: "not in schema cache" };
    }

    return { exists: false, reason: `HTTP ${response.status}` };
  }

  async function rlsBlocksAnonymousWrite(table) {
    const writeBody =
      table === "admin_feedback_reports"
        ? { report_type: "feedback", message: "rls verification probe" }
        : {};
    const response = await fetch(`${restBase}/${table}`, {
      method: "POST",
      headers: {
        ...restHeaders,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(writeBody),
    });

    if (response.status === 404) {
      return false;
    }

    return response.status < 200 || response.status >= 300;
  }

  for (const table of REQUIRED_TABLES) {
    const { exists, reason } = await tableExists(table);

    if (!exists) {
      missingTables.push(table);
      allOk = report(`  table "${table}"`, false, `missing — ${reason}`) && allOk;
      continue;
    }

    report(`  table "${table}"`, true, "exists");

    if (await rlsBlocksAnonymousWrite(table)) {
      rlsProtectedTables.push(table);
    }
  }

  console.log("\nRLS indicators:");
  if (missingTables.length > 0) {
    report("All tables present for RLS", false, `missing: ${missingTables.join(", ")}`);
    allOk = false;
  } else {
    allOk =
      report(
        "RLS blocks anonymous writes",
        rlsProtectedTables.length === REQUIRED_TABLES.length,
        `${rlsProtectedTables.length}/${REQUIRED_TABLES.length} tables rejected unauthenticated inserts`,
      ) && allOk;
  }

  if (missingTables.length > 0) {
    console.log("\nApply database schema:");
    console.log("  1. Open Supabase SQL Editor");
    console.log("  2. Run supabase/schema.sql");
    console.log("  3. Run migrations in supabase/migrations/ (oldest first)");
  } else if (rlsProtectedTables.length !== REQUIRED_TABLES.length) {
    const unprotected = REQUIRED_TABLES.filter((table) => !rlsProtectedTables.includes(table));
    console.log("\nRLS fix:");
    console.log("  Run pending migrations in supabase/migrations/ (e.g. 20260709_admin_feedback_rls.sql)");
    console.log(`  Tables not blocking anonymous writes: ${unprotected.join(", ")}`);
    console.log("  Or: npm run apply:admin-feedback-rls (requires SUPABASE_DB_PASSWORD)");
  }

  console.log("\nAnonymous access checks:");
  const anonProfilesResponse = await fetch(`${restBase}/profiles?select=id&limit=1`, {
    method: "GET",
    headers: restHeaders,
  });
  const anonProfilesBody = await anonProfilesResponse.text();
  const anonProfilesBlocked =
    anonProfilesResponse.status === 401 ||
    anonProfilesResponse.status === 403 ||
    (anonProfilesResponse.ok && anonProfilesBody.includes("[]"));
  allOk =
    report(
      "Anonymous users cannot read profiles",
      anonProfilesBlocked,
      anonProfilesResponse.ok ? "empty result" : `HTTP ${anonProfilesResponse.status}`,
    ) && allOk;

  const anonAccountsResponse = await fetch(`${restBase}/accounts?select=id&limit=1`, {
    method: "GET",
    headers: restHeaders,
  });
  allOk =
    report(
      "Anonymous users cannot read accounts",
      anonAccountsResponse.status === 401 ||
        anonAccountsResponse.status === 403 ||
        (anonAccountsResponse.ok && (await anonAccountsResponse.text()).includes("[]")),
      `HTTP ${anonAccountsResponse.status}`,
    ) && allOk;

  console.log("\nProfile column checks:");
  for (const column of REQUIRED_PROFILE_COLUMNS) {
    const response = await fetch(
      `${restBase}/profiles?select=${column}&limit=0`,
      { method: "GET", headers: restHeaders },
    );

    if (response.status === 400) {
      const body = await response.text();
      allOk =
        report(`  profiles.${column}`, false, body.includes("42703") ? "missing" : body.slice(0, 120)) &&
        allOk;
      continue;
    }

    allOk = report(`  profiles.${column}`, response.ok, response.ok ? "exists" : `HTTP ${response.status}`) && allOk;
  }

  console.log("\nStorage bucket check:");
  try {
    const serviceClient = createClient(url, serviceRoleKey || anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await serviceClient.storage.getBucket("feedback-attachments");
    if (error) {
      allOk = report("  feedback-attachments bucket", false, error.message) && allOk;
    } else {
      allOk = report("  feedback-attachments bucket", Boolean(data), data?.public ? "public" : "private") && allOk;
    }
  } catch (error) {
    allOk =
      report(
        "  feedback-attachments bucket",
        false,
        error instanceof Error ? error.message : String(error),
      ) && allOk;
  }

  console.log(`\n${allOk ? "✅ Supabase verification passed." : "❌ Supabase verification failed."}`);
  process.exit(allOk ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
