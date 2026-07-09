#!/usr/bin/env node
/**
 * Apply account management migration to Supabase.
 *
 * Usage:
 *   npm run apply:account-management-migration
 */

import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");
const MIGRATION_PATH = path.join(
  ROOT,
  "supabase/migrations/20260709_account_management.sql",
);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
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

function getProjectRef(supabaseUrl) {
  const match = supabaseUrl
    ?.replace(/\/rest\/v1\/?$/, "")
    .replace(/\/$/, "")
    .match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? null;
}

function resolveDatabaseUrl(env) {
  const direct =
    env.SUPABASE_DB_URL?.trim() ||
    env.DATABASE_URL?.trim() ||
    process.env.SUPABASE_DB_URL?.trim() ||
    process.env.DATABASE_URL?.trim();
  if (direct) return direct;
  const password =
    env.SUPABASE_DB_PASSWORD?.trim() || process.env.SUPABASE_DB_PASSWORD?.trim();
  const supabaseUrl =
    env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const projectRef = getProjectRef(supabaseUrl);
  if (password && projectRef) {
    return `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;
  }
  return null;
}

async function applyViaManagementApi(token, projectRef, sql) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Management API failed (${response.status}): ${body}`);
  }
}

async function applyViaPostgres(databaseUrl, sql) {
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function checkApplied(env) {
  const url = (
    env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    ""
  ).replace(/\/$/, "");
  const anonKey =
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return false;
  const response = await fetch(
    `${url}/rest/v1/accounts?select=nickname,include_in_net_worth&limit=0`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    },
  );
  return response.ok;
}

async function main() {
  const fileEnv = loadEnvFile(ENV_PATH);
  const sql = fs.readFileSync(MIGRATION_PATH, "utf8");
  const token =
    process.env.SUPABASE_ACCESS_TOKEN?.trim() ||
    fileEnv.SUPABASE_ACCESS_TOKEN?.trim();
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    fileEnv.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const projectRef = getProjectRef(supabaseUrl);

  if (await checkApplied(fileEnv)) {
    console.log("✓ Account management migration already applied.");
    return;
  }

  console.log("Applying account management migration...\n");

  if (token && projectRef) {
    try {
      await applyViaManagementApi(token, projectRef, sql);
      console.log("✓ Migration applied via Supabase Management API.");
      process.exit(await checkApplied(fileEnv) ? 0 : 1);
    } catch (error) {
      console.warn(
        `Management API attempt failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const databaseUrl = resolveDatabaseUrl(fileEnv);
  if (!databaseUrl) {
    console.error("Could not apply migration automatically.");
    console.error("\nSet SUPABASE_ACCESS_TOKEN or SUPABASE_DB_PASSWORD in .env.local.");
    console.error("Or run the SQL manually in Supabase SQL Editor:");
    console.error(MIGRATION_PATH);
    process.exit(1);
  }

  await applyViaPostgres(databaseUrl, sql);
  console.log("✓ Migration applied via Postgres connection.");
  process.exit((await checkApplied(fileEnv)) ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
