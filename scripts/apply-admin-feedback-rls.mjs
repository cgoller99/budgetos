#!/usr/bin/env node
/**
 * Apply admin_feedback_reports RLS migration.
 * Tries Management API first, then direct Postgres connection.
 *
 * Usage:
 *   npm run apply:admin-feedback-rls
 *   SUPABASE_ACCESS_TOKEN=sbp_... npm run apply:admin-feedback-rls
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");
const MIGRATION_PATH = path.join(
  ROOT,
  "supabase/migrations/20260709_admin_feedback_rls.sql",
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
    env.SUPABASE_DB_PASSWORD?.trim() ||
    process.env.SUPABASE_DB_PASSWORD?.trim();
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

  console.log("Applying admin feedback RLS migration...\n");

  if (token && projectRef) {
    try {
      await applyViaManagementApi(token, projectRef, sql);
      console.log("✓ Migration applied via Supabase Management API.");
      return;
    } catch (error) {
      console.warn(
        `Management API attempt failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const databaseUrl = resolveDatabaseUrl(fileEnv);
  if (!databaseUrl) {
    console.error("Could not apply migration automatically.");
    console.error("\nOption A — Supabase Dashboard → SQL Editor, run:");
    console.error(sql);
    console.error("\nOption B — set SUPABASE_ACCESS_TOKEN in .env.local and re-run.");
    console.error("Option C — set SUPABASE_DB_PASSWORD in .env.local and re-run.");
    process.exit(1);
  }

  try {
    await applyViaPostgres(databaseUrl, sql);
    console.log("✓ Migration applied via Postgres connection.");
  } catch (error) {
    console.error("✗ Migration failed:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
