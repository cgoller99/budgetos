#!/usr/bin/env node
/**
 * One-shot Buxme production setup:
 * 1. sync public env from buxme.co
 * 2. pull Vercel production secrets (requires vercel login)
 * 3. apply pending Supabase SQL (requires SUPABASE_ACCESS_TOKEN)
 * 4. run verify:production
 *
 * Usage:
 *   npm run setup:production
 *   npm run setup:production -- --skip-vercel --skip-supabase
 */

import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const skipVercel = args.includes("--skip-vercel");
const skipSupabase = args.includes("--skip-supabase");
const skipVerify = args.includes("--skip-verify");

function run(title, command, commandArgs = [], options = {}) {
  console.log(`\n${"=".repeat(72)}`);
  console.log(title);
  console.log("=".repeat(72));

  const result = spawnSync(command, commandArgs, {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
    ...options,
  });

  if (result.status !== 0) {
    console.error(`\n❌ Failed: ${title}`);
    process.exit(result.status ?? 1);
  }
}

console.log("Buxme production setup\n");

run("1/5 Sync public env from buxme.co", "node", [
  "scripts/sync-public-env-from-production.mjs",
]);

if (!skipVercel) {
  const whoami = spawnSync("npx", ["vercel", "whoami"], {
    cwd: ROOT,
    encoding: "utf8",
  });

  if (whoami.status !== 0) {
    console.log("\n⚠ Vercel CLI is not authenticated.");
    console.log("  Run: npx vercel login");
    console.log("  Then re-run: npm run setup:production");
    process.exit(1);
  }

  run("2/5 Pull Vercel production secrets", "npx", [
    "vercel",
    "env",
    "pull",
    ".env.local",
    "--environment=production",
    "--yes",
  ]);

  run("3/5 Merge public env (preserve pulled secrets)", "node", [
    "scripts/sync-public-env-from-production.mjs",
    "--public-only",
  ]);
} else {
  console.log("\nSkipping Vercel env pull (--skip-vercel)");
}

if (!skipSupabase) {
  const applyAccountManagement = spawnSync(
    "node",
    [
      "--env-file=.env.local",
      "scripts/apply-account-management-migration.mjs",
    ],
    { cwd: ROOT, stdio: "inherit", env: process.env },
  );

  if (applyAccountManagement.status !== 0) {
    console.log("\n⚠ Account management migration not applied (missing Supabase credentials?).");
    console.log("  Add SUPABASE_ACCESS_TOKEN or SUPABASE_DB_PASSWORD to .env.local and re-run.");
    console.log("  Or call POST /api/cron/apply-account-management-migration with CRON_SECRET after deploy.");
  }

  const apply = spawnSync(
    "node",
    [
      "--env-file=.env.local",
      "scripts/apply-supabase-sql-api.mjs",
      "--file",
      "supabase/migrations/20260709_admin_feedback_rls.sql",
    ],
    { cwd: ROOT, stdio: "inherit", env: process.env },
  );

  if (apply.status !== 0) {
    console.log("\n⚠ Supabase RLS migration not applied (missing SUPABASE_ACCESS_TOKEN?).");
    console.log("  Add SUPABASE_ACCESS_TOKEN to .env.local or run SQL manually.");
  }
} else {
  console.log("\nSkipping Supabase migration (--skip-supabase)");
}

console.log(`\n${"=".repeat(72)}`);
console.log("4/5 Remote production audit");
console.log("=".repeat(72));
spawnSync("node", ["scripts/audit-production-remote.mjs"], {
  cwd: ROOT,
  stdio: "inherit",
  env: process.env,
});

if (!skipVerify) {
  run("5/5 Full verification", "npm", ["run", "verify:production"]);
}

console.log("\n✅ Setup complete.");
