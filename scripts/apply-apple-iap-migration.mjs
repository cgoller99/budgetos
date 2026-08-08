#!/usr/bin/env node
/**
 * Applies Apple IAP profile columns + privilege guard extension.
 *
 * Usage: npm run apply:apple-iap-migration
 *
 * Requires SUPABASE_DB_URL in .env.local (Session Pooler URI recommended).
 * Mirrors scripts/apply-profile-privilege-guard.mjs connection resolution so
 * an empty process.env value cannot wipe .env.local and fall back to the
 * unreachable direct db.<ref>.supabase.co host.
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

function getProjectRef(supabaseUrl) {
  const match = supabaseUrl
    ?.replace(/\/rest\/v1\/?$/, "")
    .replace(/\/$/, "")
    .match(/https:\/\/([^.]+)\.supabase\.co/);

  return match?.[1] ?? null;
}

function redactDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    const user = parsed.username || "postgres";
    return `${parsed.protocol}//${user}:***@${parsed.host}${parsed.pathname}`;
  } catch {
    return "[unparseable-database-url]";
  }
}

/**
 * Prefer SUPABASE_DB_URL from .env.local exactly like the privilege-guard script.
 * Only construct a direct db.* host when no SUPABASE_DB_URL/DATABASE_URL exists.
 */
function resolveDatabaseUrl(fileEnv) {
  const fromFile =
    fileEnv.SUPABASE_DB_URL?.trim() || fileEnv.DATABASE_URL?.trim();

  if (fromFile) {
    return fromFile;
  }

  const fromProcess =
    process.env.SUPABASE_DB_URL?.trim() || process.env.DATABASE_URL?.trim();

  if (fromProcess) {
    return fromProcess;
  }

  const password =
    fileEnv.SUPABASE_DB_PASSWORD?.trim() ||
    process.env.SUPABASE_DB_PASSWORD?.trim();
  const supabaseUrl =
    fileEnv.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const projectRef = getProjectRef(supabaseUrl);

  if (password && projectRef) {
    // Last-resort fallback only when no pooler/direct URL was configured.
    return `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;
  }

  return null;
}

async function main() {
  const fileEnv = loadEnvFile(ENV_PATH);
  const databaseUrl = resolveDatabaseUrl(fileEnv);

  if (!databaseUrl) {
    console.error(
      "Missing database credentials.\n\nAdd SUPABASE_DB_URL to .env.local (Session Pooler URI):\n" +
        "  postgresql://postgres.PROJECT_REF:***@aws-0-REGION.pooler.supabase.com:5432/postgres\n",
    );
    process.exit(1);
  }

  if (!fileEnv.SUPABASE_DB_URL?.trim() && !fileEnv.DATABASE_URL?.trim()) {
    console.warn(
      "⚠ SUPABASE_DB_URL is not set in .env.local; using a fallback connection string.",
    );
    console.warn(
      "  Prefer the Session Pooler URI to avoid db.<project>.supabase.co DNS failures.\n",
    );
  }

  for (const relative of MIGRATIONS) {
    const fullPath = path.join(ROOT, relative);
    if (!fs.existsSync(fullPath)) {
      console.error(`Migration file not found: ${fullPath}`);
      process.exit(1);
    }
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  console.log("Applying Apple IAP migrations...");
  console.log(`  target: ${redactDatabaseUrl(databaseUrl)}\n`);

  try {
    await client.connect();
    for (const relative of MIGRATIONS) {
      const fullPath = path.join(ROOT, relative);
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
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
