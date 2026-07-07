#!/usr/bin/env node
/**
 * Master Buxme production readiness audit.
 *
 * Runs all production checks and exits 0 only when the app is production-ready.
 *
 * Usage:
 *   npm run verify:production
 *   npm run verify:production -- --skip-build
 *   npm run verify:production -- --skip-remote
 */

import { spawnSync } from "node:child_process";
import { hydrateProcessEnvFromFile } from "./lib/env-utils.mjs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const skipBuild = args.includes("--skip-build");
const skipRemote = args.includes("--skip-remote");

hydrateProcessEnvFromFile();

function runStep(title, command, stepArgs = []) {
  console.log(`\n${"=".repeat(72)}`);
  console.log(title);
  console.log("=".repeat(72));

  const result = spawnSync(command, stepArgs, {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    console.error(`\n❌ Failed: ${title}`);
    process.exit(result.status ?? 1);
  }
}

console.log("Buxme Production Readiness Audit");
console.log("================================");

runStep("1/6 Environment variables", "node", ["scripts/verify-env.mjs"]);
runStep("2/6 Supabase connectivity", "node", ["scripts/verify-supabase.mjs"]);

const plaidArgs = ["scripts/verify-plaid.mjs"];
if (skipRemote) {
  plaidArgs.push("--skip-remote");
}
runStep("3/6 Plaid (Production)", "node", plaidArgs);

runStep("4/6 Stripe configuration", "node", ["scripts/verify-stripe.mjs"]);
runStep("5/6 Resend configuration", "node", ["scripts/verify-resend.mjs"]);

if (skipBuild) {
  console.log("\nSkipping production build (--skip-build)");
} else {
  runStep("6/6 Production build", "npm", ["run", "build"]);
}

console.log("\n✅ Buxme is production-ready.");
