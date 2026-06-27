#!/usr/bin/env node
/**
 * Prints the household migration SQL and copies it to the clipboard on macOS.
 * Usage: npm run household:migration
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const migrationPath = path.resolve(
  import.meta.dirname,
  "../supabase/migrations/20260628_household_complete.sql",
);

if (!fs.existsSync(migrationPath)) {
  console.error(`Migration file not found: ${migrationPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(migrationPath, "utf8");

console.log("BudgetOS household migration\n");
console.log(`File: ${migrationPath}`);
console.log(`Lines: ${sql.split("\n").length}`);
console.log("\nNext steps:");
console.log("  1. Open Supabase Dashboard → SQL Editor → New query");
console.log("  2. Paste the SQL (copied to clipboard on macOS if pbcopy works)");
console.log("  3. Click Run");
console.log("  4. Wait ~30 seconds, then run: npm run verify:supabase");
console.log("\n--- SQL starts below (also sent to clipboard on macOS) ---\n");
console.log(sql);

if (process.platform === "darwin") {
  try {
    execSync("pbcopy", { input: sql });
    console.error("\n✓ Copied to clipboard. Paste into Supabase SQL Editor and Run.");
  } catch {
    console.error("\nCould not copy to clipboard. Select the SQL above manually.");
  }
}
