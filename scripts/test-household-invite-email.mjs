#!/usr/bin/env node
/**
 * Sends the exact same email the site API uses (not the generic debug test).
 * Usage: node --env-file=.env.local scripts/test-household-invite-email.mjs [email]
 */

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Dynamic import of compiled TS won't work easily - inline the send logic
import fs from "node:fs";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    values[trimmed.slice(0, index).trim()] = trimmed.slice(index + 1).trim();
  }
  return values;
}

const env = { ...loadEnvFile(path.join(ROOT, ".env.local")), ...process.env };
const to = process.argv[2] || "christiangoller99@gmail.com";
const apiKey = env.RESEND_API_KEY?.trim();
const fromEmail = env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";
const fromName = env.RESEND_FROM_NAME?.trim() || "Buxme";
const siteUrl = (env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const token = "test-token-site-template";
const inviteUrl = `${siteUrl}/household/invite/${token}`;
const subject = `You're invited to join babe on Buxme`;
const html = `<!doctype html><html><body><p>Site template test</p><a href="${inviteUrl}">View invite</a></body></html>`;
const text = `Open: ${inviteUrl}`;

console.log("Sending site-style invite email to:", to);
console.log("From:", `${fromName} <${fromEmail}>`);
console.log("Subject:", subject);

const response = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    from: `${fromName} <${fromEmail}>`,
    to: [to],
    subject,
    html,
    text,
  }),
});

const body = await response.text();
console.log("STATUS:", response.status, response.statusText);
console.log("BODY:", body);
