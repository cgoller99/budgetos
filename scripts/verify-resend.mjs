#!/usr/bin/env node
/**
 * Verifies Resend email configuration.
 *
 * Usage:
 *   npm run verify:resend
 *   node scripts/verify-resend.mjs
 */

import fs from "node:fs";
import {
  ENV_PATH,
  classifyEnvValue,
  getEnv,
  hydrateProcessEnvFromFile,
  parseEnvFile,
} from "./lib/env-utils.mjs";

hydrateProcessEnvFromFile();

const issues = [];

function fail(message) {
  issues.push(message);
  console.error(`✗ ${message}`);
}

function pass(message) {
  console.log(`✓ ${message}`);
}

console.log("Buxme Resend verification\n");

if (!fs.existsSync(ENV_PATH)) {
  console.error("✗ .env.local is missing\n");
  console.error("Fix: npm run env:pull");
  process.exit(1);
}

const map = parseEnvFile(ENV_PATH);
console.log(`✓ .env.local found (${map.size} keys parsed)\n`);

function check(name, validator) {
  const raw = map.has(name) ? map.get(name) : undefined;
  const status = classifyEnvValue(raw);

  if (status === "empty") {
    fail(`${name} is empty (key in .env.local but no value — set in Vercel Production)`);
    return;
  }

  if (status === "absent") {
    fail(`${name} is missing`);
    return;
  }

  if (status === "placeholder") {
    fail(`${name} is still a placeholder`);
    return;
  }

  validator(getEnv(name));
}

check("RESEND_API_KEY", (apiKey) => {
  if (!apiKey.startsWith("re_") || apiKey.length < 20) {
    fail("RESEND_API_KEY looks invalid (must start with re_ and be at least 20 characters)");
  } else {
    pass("RESEND_API_KEY is set");
  }
});

check("RESEND_FROM_EMAIL", (fromEmail) => {
  if (!fromEmail.includes("@")) {
    fail("RESEND_FROM_EMAIL looks invalid");
  } else {
    pass(`RESEND_FROM_EMAIL is set (${fromEmail})`);
  }
});

check("RESEND_FROM_NAME", (fromName) => {
  pass(`RESEND_FROM_NAME is set (${fromName})`);
});

const apiKey = getEnv("RESEND_API_KEY");
if (apiKey && apiKey.startsWith("re_") && apiKey.length >= 20 && !apiKey.includes("xxxx")) {
  try {
    const response = await fetch("https://api.resend.com/domains", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.status === 401 || response.status === 403) {
      fail("Resend API rejected RESEND_API_KEY");
    } else if (!response.ok) {
      fail(`Resend API check failed: HTTP ${response.status}`);
    } else {
      pass("Resend API accepted RESEND_API_KEY");
    }
  } catch (error) {
    fail(`Cannot reach Resend API: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}

console.log("");
if (issues.length > 0) {
  console.error(`❌ Resend verification failed (${issues.length} issue(s)).\n`);
  console.error("Run: npm run audit:env");
  process.exit(1);
}

console.log("✅ Resend verification passed.");
