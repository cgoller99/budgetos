#!/usr/bin/env node
/**
 * Pulls Vercel Production secrets into .env.local and verifies Resend.
 *
 * Usage:
 *   npm run env:pull
 *
 * First time: complete the browser login when prompted, then run again.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";

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
  console.log("Run this and complete the browser login:\n");
  console.log("  npx vercel login\n");
  console.log("Then run:\n");
  console.log("  npm run env:pull\n");
  process.exit(1);
}

run("npx", ["vercel", "env", "pull", ".env.local", "--environment=production", "--yes"]);
run("node", ["scripts/sync-public-env-from-production.mjs"]);
run("node", ["scripts/verify-resend.mjs"]);

console.log("\n✅ .env.local updated. Resend should be configured.");
