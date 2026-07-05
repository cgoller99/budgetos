#!/usr/bin/env node
/**
 * Applies notification preferences column migration to Supabase Postgres.
 *
 * Usage: npm run apply:notification-preferences-migration
 */

import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");
const MIGRATION_PATH = path.join(
  ROOT,
  "supabase/migrations/20260709_notification_preferences.sql",
);

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

  if (!fs.existsSync(MIGRATION_PATH)) {
    console.error(`Migration file not found: ${MIGRATION_PATH}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(MIGRATION_PATH, "utf8");
  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  console.log("Applying notification preferences migration...\n");

  try {
    await client.connect();
    await client.query(sql);
    console.log("✓ Migration applied successfully.");
  } catch (error) {
    console.error("✗ Migration failed:");
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
