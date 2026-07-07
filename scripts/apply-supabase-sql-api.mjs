#!/usr/bin/env node
/**
 * Apply SQL to Supabase via Management API (no database password required).
 *
 * Requires SUPABASE_ACCESS_TOKEN from https://supabase.com/dashboard/account/tokens
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-supabase-sql-api.mjs --file supabase/migrations/20260709_admin_feedback_rls.sql
 *   npm run apply:supabase-sql -- --file supabase/migrations/20260709_admin_feedback_rls.sql
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");

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

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const fileEnv = loadEnvFile(ENV_PATH);
  const token =
    process.env.SUPABASE_ACCESS_TOKEN?.trim() ||
    fileEnv.SUPABASE_ACCESS_TOKEN?.trim();
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    fileEnv.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const projectRef = supabaseUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  const filePath = getArg("--file");

  if (!token) {
    console.error("Missing SUPABASE_ACCESS_TOKEN.");
    console.error("Create one at https://supabase.com/dashboard/account/tokens");
    process.exit(1);
  }

  if (!projectRef) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL project ref.");
    process.exit(1);
  }

  if (!filePath) {
    console.error("Usage: --file path/to/migration.sql");
    process.exit(1);
  }

  const absolutePath = path.resolve(ROOT, filePath);
  const query = fs.readFileSync(absolutePath, "utf8");

  console.log(`Applying ${filePath} to ${projectRef} via Management API...\n`);

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query }),
    },
  );

  const body = await response.text();

  if (!response.ok) {
    console.error(`✗ Failed (${response.status}):`, body);
    process.exit(1);
  }

  console.log("✓ SQL applied successfully.");
  if (body.trim() && body.trim() !== "{}") {
    console.log(body);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
