#!/usr/bin/env node
/**
 * Master Buxme production readiness audit.
 *
 * Production runtime probes are authoritative. Missing local secrets in
 * .env.local are warnings (not failures) when buxme.co is healthy.
 *
 * Usage:
 *   npm run verify:production
 *   npm run verify:production -- --skip-build
 *   npm run verify:production -- --skip-remote
 */

import { spawnSync } from "node:child_process";
import { hydrateProcessEnvFromFile } from "./lib/env-utils.mjs";
import {
  DEFAULT_SITE_URL,
  probeProductionHealth,
  printRemoteHealthSummary,
} from "./lib/remote-production-health.mjs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const skipBuild = args.includes("--skip-build");
const skipRemote = args.includes("--skip-remote");

hydrateProcessEnvFromFile();

let remoteHealthy = false;

function runStep(title, command, stepArgs = [], { soft = false } = {}) {
  console.log(`\n${"=".repeat(72)}`);
  console.log(title);
  console.log("=".repeat(72));

  const result = spawnSync(command, stepArgs, {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    if (soft && remoteHealthy) {
      console.warn(`\n⚠ Step reported issues but production runtime is healthy: ${title}`);
      console.warn("  Missing local secrets are expected — copy from provider dashboards for local dev.");
      return false;
    }

    console.error(`\n❌ Failed: ${title}`);
    process.exit(result.status ?? 1);
  }

  return true;
}

console.log("Buxme Production Readiness Audit");
console.log("================================");

if (skipRemote) {
  console.warn("\n⚠ Skipping production runtime probe (--skip-remote). Local checks will be strict.\n");
} else {
  const remote = await probeProductionHealth(
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || DEFAULT_SITE_URL,
  );
  remoteHealthy = remote.healthy;
  printRemoteHealthSummary(remote);

  if (!remoteHealthy) {
    console.error("\n❌ Production runtime is unhealthy. Fix the live deployment before continuing.");
    for (const error of remote.plaid.errors) {
      console.error(`  • ${error}`);
    }
    process.exit(1);
  }
}

const softLocal = remoteHealthy;

runStep(
  "1/6 Environment variables (local)",
  "node",
  softLocal ? ["scripts/verify-env.mjs", "--warn-local-secrets"] : ["scripts/verify-env.mjs"],
  { soft: softLocal },
);

runStep("2/6 Supabase connectivity", "node", ["scripts/verify-supabase.mjs"], { soft: softLocal });

const plaidArgs = ["scripts/verify-plaid.mjs"];
if (skipRemote) {
  plaidArgs.push("--skip-remote");
}
runStep("3/6 Plaid (Production)", "node", plaidArgs);

runStep("4/6 Stripe configuration", "node", ["scripts/verify-stripe.mjs"], { soft: softLocal });
runStep("5/6 Resend configuration", "node", ["scripts/verify-resend.mjs"], { soft: softLocal });

if (skipBuild) {
  console.log("\nSkipping production build (--skip-build)");
} else {
  runStep("6/6 Production build", "npm", ["run", "build"]);
}

console.log("\n✅ Buxme is production-ready.");
if (softLocal) {
  console.log("   Production runtime verified on buxme.co.");
  console.log("   Local secret gaps were warnings only — copy from provider dashboards when needed.");
}
