#!/usr/bin/env node
/**
 * Step-by-step household invite email debugger.
 * Usage: node --env-file=.env.local scripts/debug-household-invite-email.mjs [recipient@email.com]
 */

import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

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

function getConfigurationError(apiKey) {
  if (!apiKey) {
    return "RESEND_API_KEY is missing. Add it to .env.local and restart the dev server.";
  }
  if (["re_xxxxx", "re_your_resend_api_key"].includes(apiKey) || apiKey.includes("xxxx")) {
    return "RESEND_API_KEY is still a placeholder. Paste your real key from https://resend.com/api-keys";
  }
  if (!apiKey.startsWith("re_") || apiKey.length < 20) {
    return "RESEND_API_KEY looks invalid. Resend keys start with re_ and are longer than 20 characters.";
  }
  return null;
}

const fileEnv = loadEnvFile(ENV_PATH);
const env = { ...fileEnv, ...process.env };
const recipient = process.argv[2] || "alahnnaf@gmail.com";

function step(label, details) {
  console.log(`\n=== ${label} ===`);
  if (typeof details === "string") {
    console.log(details);
    return;
  }
  console.log(JSON.stringify(details, null, 2));
}

step("1. Env file keys present", {
  envFileExists: fs.existsSync(ENV_PATH),
  envFileLineCount: fs.existsSync(ENV_PATH)
    ? fs.readFileSync(ENV_PATH, "utf8").split("\n").filter(Boolean).length
    : 0,
  keysInEnvFile: Object.keys(fileEnv),
});

const apiKey = env.RESEND_API_KEY?.trim();
const fromEmail = env.RESEND_FROM_EMAIL?.trim() || "onboarding@resend.dev";
const fromName = env.RESEND_FROM_NAME?.trim() || "Buxme";
const siteUrl = env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";

step("3. RESEND_API_KEY loaded", {
  present: Boolean(apiKey),
  length: apiKey?.length ?? 0,
  prefix: apiKey ? `${apiKey.slice(0, 6)}...` : null,
  configurationError: getConfigurationError(apiKey),
});

step("4. RESEND_FROM_EMAIL", { fromEmail, fromName });
step("5. NEXT_PUBLIC_SITE_URL", { siteUrl });

const dbUrl = env.SUPABASE_DB_URL;
if (!dbUrl) {
  step("9. Supabase invite records", "SUPABASE_DB_URL not set — skipped");
} else {
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const invites = await client.query(
      `select id, email, status, token, expires_at > now() as not_expired, created_at
       from public.household_invites
       order by created_at desc
       limit 3`,
    );
    step("9. Recent invite records in Supabase", invites.rows);

    const fn = await client.query(
      `select proname from pg_proc where proname = 'get_household_invite_by_token'`,
    );
    step("Invite landing RPC", {
      get_household_invite_by_token_exists: fn.rows.length > 0,
    });

    const latest = invites.rows[0];
    if (latest?.token) {
      const inviteUrl = `${siteUrl.replace(/\/$/, "")}/household/invite/${encodeURIComponent(latest.token)}`;
      step("10-11. Latest invite token + URL", {
        tokenLength: latest.token.length,
        tokenPreview: `${latest.token.slice(0, 8)}...`,
        inviteUrl,
        urlLooksValid: inviteUrl.startsWith("http") && inviteUrl.includes("/household/invite/"),
      });
    }
  } catch (error) {
    step("9. Supabase query failed", error.message);
  } finally {
    await client.end().catch(() => {});
  }
}

step("12. Resend send attempt", {
  attempted: Boolean(apiKey),
  to: recipient,
  from: `${fromName} <${fromEmail}>`,
});

const configurationError = getConfigurationError(apiKey);

if (configurationError) {
  step("6-7. Resend response", {
    skipped: true,
    error: `EmailNotConfiguredError: ${configurationError}`,
  });
  process.exit(1);
}

const testSubject = "Buxme invite email debug test";
const testHtml = "<p>Debug test from scripts/debug-household-invite-email.mjs</p>";
const testText = "Debug test";

try {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [recipient],
      subject: testSubject,
      html: testHtml,
      text: testText,
    }),
  });

  const rawBody = await response.text();
  let parsedBody = rawBody;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    // keep raw text
  }

  step("6. Resend HTTP status", {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
  });

  step("7. Complete Resend response body", parsedBody);

  if (!response.ok) {
    process.exit(1);
  }
} catch (error) {
  step("6-7. Resend request failed", {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
}
