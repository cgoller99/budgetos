#!/usr/bin/env node
/**
 * Applies bank_connections owner-only RLS migration.
 * Usage: npm run apply:bank-connections-owner-rls
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");
const MIGRATION_PATH = path.join(
  ROOT,
  "supabase/migrations/20261001_bank_connections_owner_only.sql",
);

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

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

const fileEnv = loadEnvFile(ENV_PATH);
const connectionString =
  process.env.DATABASE_URL?.trim() ||
  process.env.SUPABASE_DB_URL?.trim() ||
  fileEnv.DATABASE_URL?.trim() ||
  fileEnv.SUPABASE_DB_URL?.trim();

if (!connectionString) {
  console.error("Missing DATABASE_URL / SUPABASE_DB_URL in env.");
  process.exit(1);
}

const sql = fs.readFileSync(MIGRATION_PATH, "utf8");
const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  const policies = await client.query(
    `select policyname, cmd, qual::text as using_expr
     from pg_policies
     where schemaname = 'public' and tablename = 'bank_connections'
     order by policyname`,
  );
  console.log("Applied bank_connections owner-only RLS.");
  console.log(policies.rows);
  const householdPolicy = policies.rows.find((row) =>
    String(row.policyname).includes("household"),
  );
  if (householdPolicy) {
    console.error("FAIL: household policy still present", householdPolicy);
    process.exit(1);
  }
} finally {
  await client.end();
}
