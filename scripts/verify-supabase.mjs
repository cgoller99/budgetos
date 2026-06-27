#!/usr/bin/env node
/**
 * Verifies Supabase env, client init, table presence, and basic API connectivity.
 * Usage: node scripts/verify-supabase.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");

const REQUIRED_TABLES = [
  "profiles",
  "accounts",
  "transactions",
  "bills",
  "goals",
  "investments",
  "recurring_items",
  "notifications",
  "households",
  "household_members",
  "household_invites",
];

const REQUIRED_PROFILE_COLUMNS = ["household_id"];

const MIGRATION_FILES = [
  "supabase/schema.sql",
  "supabase/migrations/20260627_auth_rls.sql",
  "supabase/migrations/20260627_backend_tables.sql",
  "supabase/migrations/20260627_recurring_engine.sql",
  "supabase/migrations/20260627_transaction_engine.sql",
  "supabase/migrations/20260627_profiles_onboarding.sql",
  "supabase/migrations/20260627_feature_expansion.sql",
  "supabase/migrations/20260628_household_complete.sql",
];

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
  console.log("BudgetOS Supabase verification\n");

  let allOk = true;

  for (const file of MIGRATION_FILES) {
    const exists = fs.existsSync(path.join(ROOT, file));
    allOk = report(`Migration file present (${file})`, exists) && allOk;
  }

  console.log("");

  const fileEnv = loadEnvFile(ENV_PATH);
  const rawUrl = (fileEnv.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const url = rawUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  const anonKey = (
    fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
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

  if (!url || !anonKey) {
    console.log("\nCannot test live connection until .env.local values are filled.");
    process.exit(allOk ? 1 : 1);
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
    const response = await fetch(`${restBase}/${table}?select=id&limit=0`, {
      method: "GET",
      headers: restHeaders,
    });

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
    const response = await fetch(`${restBase}/${table}`, {
      method: "POST",
      headers: {
        ...restHeaders,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({}),
    });

    if (response.status === 404) {
      return false;
    }

    return response.status === 401 || response.status === 403;
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
    console.log("  4. Household sharing: open supabase/migrations/20260628_household_complete.sql in your repo, copy ALL SQL, paste into SQL Editor, Run");
    console.log("     (Do not paste the file path — paste the SQL file contents)");
  }

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

  console.log(`\n${allOk ? "All checks passed." : "Some checks failed."}`);
  process.exit(allOk ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
