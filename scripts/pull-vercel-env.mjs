#!/usr/bin/env node
/**
 * Pulls Vercel Production env metadata into .env.local.
 *
 * IMPORTANT: Production variables use Vercel type=sensitive by default.
 * vercel env pull writes KEY="" for sensitive values — this is expected.
 * Use this script to discover which keys exist, then copy values from
 * provider dashboards (Supabase, Stripe, Plaid, Resend, PostHog).
 *
 * Usage:
 *   npm run env:pull
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ENV_PATH, getRequiredVarNames, parseEnvFile } from "./lib/env-utils.mjs";

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
console.log("Note: vercel env pull cannot export sensitive Production values.");
console.log("It will write KEY=\"\" even when buxme.co runtime has the real secret.\n");

const loggedIn = run("npx", ["vercel", "whoami"], { allowFail: true });

if (!loggedIn) {
  console.log("\nNot logged in to Vercel yet.");
  console.log("Run: npx vercel login\nThen: npm run env:pull\n");
  process.exit(1);
}

if (!fs.existsSync(path.join(ROOT, ".vercel", "project.json"))) {
  console.log("Project not linked. Run: npx vercel link\n");
  process.exit(1);
}

const beforeKeys = fs.existsSync(ENV_PATH) ? parseEnvFile(ENV_PATH).size : 0;

run("npx", ["vercel", "env", "pull", ".env.local", "--environment=production", "--yes"]);

const pulled = parseEnvFile(ENV_PATH);
const required = getRequiredVarNames();
const empty = required.filter((name) => pulled.has(name) && pulled.get(name) === "");
const absent = required.filter((name) => !pulled.has(name));
const ok = required.filter((name) => pulled.has(name) && pulled.get(name) !== "");

console.log(`\nPulled ${pulled.size} keys from Vercel (${beforeKeys} before).`);
console.log(`  Required with values: ${ok.length}`);
console.log(`  Required but empty (sensitive — expected from pull): ${empty.length}`);
console.log(`  Required not in Vercel at all: ${absent.length}`);

if (absent.length > 0) {
  console.log("\n✗ Add these in Vercel Dashboard → Settings → Environment Variables → Production:");
  for (const name of absent) {
    console.log(`  • ${name}`);
  }
}

if (empty.length > 0) {
  console.log("\n⚠ Empty after pull is normal for sensitive Production vars.");
  console.log("Copy each value from its provider dashboard into .env.local manually.");
}

// Merge public defaults only — never rewrite or comment out pulled secrets.
run("node", ["scripts/sync-public-env-from-production.mjs", "--public-only"]);

run("node", ["scripts/audit-env.mjs"], { allowFail: true });

console.log("\nDo not run vercel env pull again expecting secrets — use dashboard copies instead.");
console.log("Next: npm run verify:production");
