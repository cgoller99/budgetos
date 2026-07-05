#!/usr/bin/env node
/**
 * Verifies Financial Allocation Engine tables exist on Supabase Postgres.
 *
 * Usage: npm run verify:allocation-migration
 */

import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");

const REQUIRED_TABLES = ["envelope_balances", "allocation_ledger"];

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

  if (direct) {
    return direct;
  }

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

async function main() {
  const fileEnv = loadEnvFile(ENV_PATH);
  const databaseUrl = resolveDatabaseUrl(fileEnv);

  if (!databaseUrl) {
    console.error(
      "Missing database credentials.\n\nAdd SUPABASE_DB_URL to .env.local",
    );
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  console.log("Verifying allocation engine migration (20260707)...\n");

  try {
    await client.connect();

    const { rows } = await client.query(
      `
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_name = any($1::text[])
        order by table_name
      `,
      [REQUIRED_TABLES],
    );

    const found = new Set(rows.map((row) => row.table_name));
    const missing = REQUIRED_TABLES.filter((name) => !found.has(name));

    for (const table of REQUIRED_TABLES) {
      console.log(found.has(table) ? `✓ ${table}` : `✗ ${table} (missing)`);
    }

    if (missing.length > 0) {
      console.error(
        `\nAllocation migration incomplete. Run: npm run apply:allocation-migration`,
      );
      process.exit(1);
    }

    console.log("\n✓ All allocation engine tables present.");
  } catch (error) {
    console.error("✗ Verification failed:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
