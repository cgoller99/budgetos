#!/usr/bin/env node
/**
 * Audits .env.local against Buxme's required production variables.
 * Optionally compares with Vercel Production when logged in.
 *
 * Usage:
 *   npm run audit:env
 *   node scripts/audit-env.mjs --vercel
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import {
  ENV_CATALOG,
  ENV_PATH,
  classifyEnvValue,
  getRequiredVarNames,
  parseEnvFile,
} from "./lib/env-utils.mjs";

const args = process.argv.slice(2);
const checkVercel = args.includes("--vercel");

function printChecklist() {
  console.log("\nRequired variable checklist (copy values into Vercel Production + .env.local):\n");

  for (const { group, vars } of ENV_CATALOG) {
    console.log(`── ${group} ──`);
    for (const variable of vars) {
      const tag = variable.required ? "required" : "optional";
      console.log(`  ${variable.name} [${tag}]`);
      console.log(`    Where: ${variable.source}`);
      if (variable.example) {
        console.log(`    Example: ${variable.example}`);
      }
    }
    console.log("");
  }
}

function auditLocalFile() {
  console.log("Buxme environment audit\n");

  if (!fs.existsSync(ENV_PATH)) {
    console.error(`✗ Missing ${ENV_PATH}`);
    printChecklist();
    process.exit(1);
  }

  const map = parseEnvFile(ENV_PATH);
  const required = getRequiredVarNames();
  const issues = [];

  console.log(`Reading ${ENV_PATH} (${map.size} keys parsed)\n`);

  let okCount = 0;
  let emptyCount = 0;
  let missingCount = 0;
  let placeholderCount = 0;

  for (const name of required) {
    const status = map.has(name) ? classifyEnvValue(map.get(name)) : "absent";

    if (status === "ok") {
      console.log(`✓ ${name}`);
      okCount += 1;
      continue;
    }

    if (status === "empty") {
      console.error(`✗ ${name} is empty (key exists in .env.local but value is blank)`);
      emptyCount += 1;
      issues.push(`${name}: empty in .env.local — sensitive Vercel vars cannot be exported via env pull`);
      continue;
    }

    if (status === "placeholder") {
      console.error(`✗ ${name} is still a placeholder`);
      placeholderCount += 1;
      issues.push(`${name}: placeholder value`);
      continue;
    }

    console.error(`✗ ${name} is missing (not in .env.local)`);
    missingCount += 1;
    issues.push(`${name}: not present in .env.local`);
  }

  console.log("\nSummary:");
  console.log(`  OK: ${okCount}/${required.length}`);
  console.log(`  Empty: ${emptyCount}`);
  console.log(`  Missing: ${missingCount}`);
  console.log(`  Placeholder: ${placeholderCount}`);

  if (emptyCount > 0) {
    const emptyKeys = required.filter((name) => map.has(name) && classifyEnvValue(map.get(name)) === "empty");
    const looksLikeVercelPull =
      fs.readFileSync(ENV_PATH, "utf8").includes("# Created by Vercel CLI") &&
      emptyKeys.length >= 5;

    console.log("\n⚠ Empty values — likely causes:");
    if (looksLikeVercelPull) {
      console.log("  • PRIMARY: Vercel Production vars use type=sensitive (CLI default).");
      console.log("    vercel env pull CANNOT export sensitive values — it writes KEY=\"\" by design.");
      console.log("    Values still work on buxme.co at runtime; they are not readable via CLI.");
      console.log("  • Fix local .env.local: copy values from each provider dashboard (see checklist below).");
      console.log("    Do NOT rely on vercel env pull for Production secrets.");
    } else {
      console.log("  1. Variable exists in Vercel but no value was saved in the dashboard");
      console.log("  2. Variable was added via broken `vercel env add --value` (stores empty — use dashboard instead)");
      console.log("  3. npm run sync:env ran after vercel env pull and commented out empty keys (fixed in latest code)");
    }
  }

  return issues;
}

async function auditVercel() {
  console.log("\nVercel Production comparison\n");

  const whoami = spawnSync("npx", ["vercel", "whoami"], { encoding: "utf8" });
  if (whoami.status !== 0) {
    console.log("⚠ Not logged in to Vercel CLI — skipping remote comparison");
    console.log("  Run: npx vercel login");
    return [];
  }

  const list = spawnSync("npx", ["vercel", "env", "ls", "production", "--json"], {
    encoding: "utf8",
  });

  if (list.status !== 0) {
    console.log("⚠ Could not list Vercel env vars (link project with: npx vercel link)");
    return [];
  }

  let remote = [];
  try {
    remote = JSON.parse(list.stdout);
  } catch {
    console.log("⚠ Unexpected vercel env ls output");
    return [];
  }

  const remoteKeys = new Set(remote.map((entry) => entry.key));
  const local = parseEnvFile(ENV_PATH);
  const issues = [];

  for (const name of getRequiredVarNames()) {
    if (!remoteKeys.has(name)) {
      console.error(`✗ ${name} not configured in Vercel Production`);
      issues.push(`${name}: missing from Vercel Production`);
      continue;
    }

    const localStatus = local.has(name) ? classifyEnvValue(local.get(name)) : "absent";
    if (localStatus === "ok") {
      console.log(`✓ ${name} (Vercel + local)`);
    } else {
      console.error(`✗ ${name} in Vercel but local is ${localStatus}`);
    }
  }

  return issues;
}

const localIssues = auditLocalFile();
const vercelIssues = checkVercel ? await auditVercel() : [];
const allIssues = [...localIssues, ...vercelIssues];

if (allIssues.length > 0) {
  printChecklist();
  console.error(`\n❌ ${allIssues.length} issue(s) found.\n`);
  process.exit(1);
}

console.log("\n✅ All required environment variables are present locally.");
printChecklist();
