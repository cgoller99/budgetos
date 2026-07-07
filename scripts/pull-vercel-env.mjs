#!/usr/bin/env node
/**
 * Pulls Vercel Production secrets into .env.local, then merges public vars only.
 *
 * Usage:
 *   npm run env:pull
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ENV_PATH, parseEnvFile } from "./lib/env-utils.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

function run(command, args, { allowFail = false } = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0 && !allowFail) {
    process.exit(result.status ?? 1);
  }

  return result.status === 0;
}

console.log("Buxme — pull Production env from Vercel\n");

const loggedIn = run("npx", ["vercel", "whoami"], { allowFail: true });

if (!loggedIn) {
  console.log("\nNot logged in to Vercel yet.");
  console.log("Run: npx vercel login\nThen: npm run env:pull\n");
  process.exit(1);
}

const beforeKeys = fs.existsSync(ENV_PATH) ? parseEnvFile(ENV_PATH).size : 0;

run("npx", ["vercel", "env", "pull", ".env.local", "--environment=production", "--yes"]);

const afterPull = parseEnvFile(ENV_PATH);
console.log(`\nPulled ${afterPull.size} keys from Vercel (${beforeKeys} before).`);

const emptyRequired = [...afterPull.entries()].filter(([, value]) => value === "").map(([key]) => key);
if (emptyRequired.length > 0) {
  console.log(`\n⚠ ${emptyRequired.length} Vercel variable(s) have empty values:`);
  for (const key of emptyRequired.slice(0, 15)) {
    console.log(`  • ${key}`);
  }
  if (emptyRequired.length > 15) {
    console.log(`  … and ${emptyRequired.length - 15} more`);
  }
  console.log("\nEmpty in Vercel Production means the dashboard value was never saved.");
  console.log("Run: npm run audit:env -- --vercel");
}

// Merge public defaults only — never rewrite or comment out pulled secrets.
run("node", ["scripts/sync-public-env-from-production.mjs", "--public-only"]);

run("node", ["scripts/audit-env.mjs"], { allowFail: true });

console.log("\nNext: npm run verify:production");
