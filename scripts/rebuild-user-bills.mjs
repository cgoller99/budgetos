#!/usr/bin/env node
/**
 * Admin rebuild: sync Plaid, reconcile bill payments, and print diagnostics.
 *
 * Usage:
 *   node --env-file=.env.local scripts/rebuild-user-bills.mjs --email user@example.com
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import crypto from "node:crypto";

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
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function getArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function decryptToken(connection, encryptionKey) {
  const iv = Buffer.from(connection.access_token_iv, "base64");
  const tag = Buffer.from(connection.access_token_tag, "base64");
  const ciphertext = Buffer.from(connection.access_token_encrypted, "base64");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    Buffer.from(encryptionKey, "base64"),
    iv,
  );
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

async function main() {
  const fileEnv = loadEnvFile(ENV_PATH);
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? fileEnv.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    fileEnv.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const plaidClientId = process.env.PLAID_CLIENT_ID ?? fileEnv.PLAID_CLIENT_ID;
  const plaidSecret = process.env.PLAID_SECRET ?? fileEnv.PLAID_SECRET;
  const plaidEnv = process.env.PLAID_ENV ?? fileEnv.PLAID_ENV ?? "production";
  const encryptionKey =
    process.env.PLAID_TOKEN_ENCRYPTION_KEY ?? fileEnv.PLAID_TOKEN_ENCRYPTION_KEY;

  if (!url || !serviceRoleKey) {
    console.error("Missing Supabase service role credentials.");
    process.exit(1);
  }

  const email = getArg("email");
  if (!email) {
    console.error("Provide --email.");
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (usersError) throw usersError;

  const user = usersData.users.find(
    (item) => item.email?.toLowerCase() === email.toLowerCase(),
  );
  if (!user) {
    console.error("User not found.");
    process.exit(1);
  }

  const userId = user.id;
  console.log(`Rebuilding bills for user ${userId}`);

  const { data: connections } = await supabase
    .from("bank_connections")
    .select("*")
    .eq("user_id", userId)
    .neq("status", "disconnected");

  if (plaidClientId && plaidSecret && encryptionKey && connections?.length) {
    const plaid = new PlaidApi(
      new Configuration({
        basePath: PlaidEnvironments[plaidEnv] ?? PlaidEnvironments.production,
        baseOptions: {
          headers: {
            "PLAID-CLIENT-ID": plaidClientId,
            "PLAID-SECRET": plaidSecret,
          },
        },
      }),
    );

    for (const connection of connections) {
      if (!connection.access_token_encrypted) continue;
      try {
        const accessToken = decryptToken(connection, encryptionKey);
        await plaid.transactionsRefresh({ access_token: accessToken });
        console.log(`Requested Plaid refresh for connection ${connection.id}`);
      } catch (error) {
        console.warn(`Plaid refresh skipped for ${connection.id}: ${error.message}`);
      }
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? fileEnv.NEXT_PUBLIC_SITE_URL ?? "https://buxme.co";
  const rebuildResponse = await fetch(`${siteUrl}/api/admin/users/${userId}/finance-audit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.ADMIN_REBUILD_TOKEN
        ? { Authorization: `Bearer ${process.env.ADMIN_REBUILD_TOKEN}` }
        : {}),
    },
  }).catch(() => null);

  if (rebuildResponse?.ok) {
    const payload = await rebuildResponse.json();
    console.log(JSON.stringify(payload.audit ?? payload, null, 2));
    return;
  }

  console.log("Admin API unavailable locally — run POST /api/admin/users/:id/finance-audit from admin session.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
