#!/usr/bin/env node
/**
 * Verifies Resend email configuration.
 *
 * Usage:
 *   npm run verify:resend
 *   node scripts/verify-resend.mjs
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[trimmed.slice(0, index).trim()] = value;
  }
  return values;
}

function hydrateEnvFromFile() {
  for (const [key, value] of Object.entries(loadEnvFile(ENV_PATH))) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function getEnv(name) {
  return process.env[name]?.trim() || "";
}

hydrateEnvFromFile();

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
  console.error("Fix:");
  console.error("  cp .env.local.example .env.local");
  console.error("  npm run sync:env");
  console.error("  vercel env pull .env.local --environment=production");
  process.exit(1);
}

console.log(`✓ .env.local found (${ENV_PATH})\n`);

const apiKey = getEnv("RESEND_API_KEY");
const fromEmail = getEnv("RESEND_FROM_EMAIL");
const fromName = getEnv("RESEND_FROM_NAME");

if (!apiKey) {
  fail("RESEND_API_KEY is missing");
} else if (["re_xxxxx", "re_your_resend_api_key"].includes(apiKey) || apiKey.includes("xxxx")) {
  fail("RESEND_API_KEY is still a placeholder");
} else if (!apiKey.startsWith("re_") || apiKey.length < 20) {
  fail("RESEND_API_KEY looks invalid (must start with re_ and be at least 20 characters)");
} else {
  pass("RESEND_API_KEY is set");
}

if (!fromEmail) {
  fail("RESEND_FROM_EMAIL is missing");
} else if (!fromEmail.includes("@")) {
  fail("RESEND_FROM_EMAIL looks invalid");
} else {
  pass(`RESEND_FROM_EMAIL is set (${fromEmail})`);
}

if (!fromName) {
  fail("RESEND_FROM_NAME is missing");
} else {
  pass(`RESEND_FROM_NAME is set (${fromName})`);
}

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
  console.error("Fix your .env.local (lines must NOT be commented out):\n");
  console.error("  # Quick fill for sender (public values):");
  console.error("  npm run sync:env\n");
  console.error("  # Pull RESEND_API_KEY from Vercel Production:");
  console.error("  vercel login");
  console.error("  vercel env pull .env.local --environment=production\n");
  console.error("  # Or paste manually from https://resend.com/api-keys:");
  console.error("  RESEND_API_KEY=re_...");
  console.error("  RESEND_FROM_EMAIL=noreply@buxme.co");
  console.error("  RESEND_FROM_NAME=Buxme");
  process.exit(1);
}

console.log("✅ Resend verification passed.");
