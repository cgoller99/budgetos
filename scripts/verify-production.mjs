#!/usr/bin/env node
/**
 * Master Buxme production readiness audit.
 *
 * Usage:
 *   npm run verify:production
 *   npm run verify:production -- --skip-remote --skip-build
 */

import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const skipRemote = args.includes("--skip-remote");
const skipBuild = args.includes("--skip-build");

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

runStep("1/6 Environment variables", "node", ["--env-file=.env.local", "scripts/verify-env.mjs"]);
runStep("2/6 Supabase", "node", ["--env-file=.env.local", "scripts/verify-supabase.mjs"]);

const plaidArgs = ["--env-file=.env.local", "scripts/verify-plaid.mjs"];
if (skipRemote) plaidArgs.push("--skip-remote");
runStep("3/6 Plaid", "node", plaidArgs);

runStep("4/6 Stripe", "node", ["--env-file=.env.local", "scripts/verify-stripe.mjs"]);
runStep("5/6 TypeScript", "npx", ["tsc", "--noEmit"]);
runStep("6/6 ESLint", "npm", ["run", "lint"]);

if (!skipBuild) {
  runStep("7/7 Production build", "npm", ["run", "build"]);
}

console.log("\n✅ Buxme is production-ready.");
console.log("Recommended: connect one test bank account and confirm sync end-to-end.");
