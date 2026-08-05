#!/usr/bin/env node
/**
 * Applies Apple IAP profile columns + privilege guard extension.
 *
 * Usage: npm run apply:apple-iap-migration
 */

import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");

const MIGRATIONS = [
  "supabase/migrations/20260805_apple_iap_subscriptions.sql",
  "supabase/migrations/20260805_apple_iap_privilege_guard.sql",
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
    env.SUPABASE_DB_PASSWORD?.trim() || process.env.SUPABASE_DB_PASSWORD?.trim();
  const supabaseUrl =
    env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const match = supabaseUrl
    ?.replace(/\/$/, "")
    .match(/https:\/\/([^.]+)\.supabase\.co/);

  if (!password || !match) {
    return null;
  }

  return `postgresql://postgres:${encodeURIComponent(password)}@db.${match[1]}.supabase.co:5432/postgres`;
}

async function main() {
  const env = { ...loadEnvFile(ENV_PATH), ...process.env };
  const databaseUrl = resolveDatabaseUrl(env);

  if (!databaseUrl) {
    console.error(
      "Missing database credentials.\n\nAdd SUPABASE_DB_URL or SUPABASE_DB_PASSWORD to .env.local",
    );
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  console.log("Applying Apple IAP migrations...\n");

  try {
    await client.connect();
    for (const relative of MIGRATIONS) {
      const fullPath = path.join(ROOT, relative);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Missing migration: ${fullPath}`);
      }
      await client.query(fs.readFileSync(fullPath, "utf8"));
      console.log(`✓ ${relative}`);
    }
    console.log("✓ Apple IAP migrations applied.");
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
