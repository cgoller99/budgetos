#!/usr/bin/env node
/**
 * Live production verification for bank_connections owner-only RLS.
 *
 * Usage: npm run verify:bank-connections-owner-rls-live
 *
 * Requires .env.local with SUPABASE_DB_URL (or DATABASE_URL).
 * Optional: TEST_OWNER_EMAIL/PASSWORD + TEST_PEER_EMAIL/PASSWORD for
 * authenticated SELECT boundary checks via anon key.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

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

const fileEnv = loadEnvFile(ENV_PATH);
const env = { ...fileEnv, ...process.env };
const connectionString =
  env.DATABASE_URL?.trim() || env.SUPABASE_DB_URL?.trim();

if (!connectionString) {
  console.error("Missing DATABASE_URL / SUPABASE_DB_URL — cannot verify production RLS.");
  process.exit(2);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  const policies = await client.query(
    `select policyname, cmd, qual::text as using_expr, with_check::text as with_check_expr
     from pg_policies
     where schemaname = 'public' and tablename = 'bank_connections'
     order by policyname`,
  );

  console.log("Production bank_connections policies:");
  console.log(policies.rows);

  const household = policies.rows.find((row) =>
    String(row.policyname).toLowerCase().includes("household"),
  );
  assert.equal(household, undefined, "household SELECT policy must be absent");

  const owner = policies.rows.find(
    (row) => row.policyname === "Bank connections manageable by owner",
  );
  assert.ok(owner, "owner FOR ALL policy must exist");
  assert.match(String(owner.using_expr), /uid\(\)\s*=\s*user_id|user_id\s*=\s*.*uid\(\)/i);

  const comment = await client.query(
    `select obj_description('public.bank_connections'::regclass) as comment`,
  );
  console.log("Table comment:", comment.rows[0]?.comment ?? null);

  console.log("✅ Production pg_policies verified owner-only.");
} finally {
  await client.end();
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const ownerEmail = env.TEST_OWNER_EMAIL?.trim();
const ownerPassword = env.TEST_OWNER_PASSWORD?.trim();
const peerEmail = env.TEST_PEER_EMAIL?.trim();
const peerPassword = env.TEST_PEER_PASSWORD?.trim();

if (!supabaseUrl || !anonKey || !ownerEmail || !ownerPassword || !peerEmail || !peerPassword) {
  console.log(
    "⏭️ Skipping authenticated SELECT boundary checks (set TEST_OWNER_* and TEST_PEER_*).",
  );
  process.exit(0);
}

async function signIn(email, password) {
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(`Sign-in failed for ${email}: ${error?.message ?? "no user"}`);
  }
  return { supabase, userId: data.user.id };
}

const owner = await signIn(ownerEmail, ownerPassword);
const peer = await signIn(peerEmail, peerPassword);

const { data: ownerRows, error: ownerError } = await owner.supabase
  .from("bank_connections")
  .select("id, user_id, institution_name, access_token_encrypted")
  .eq("user_id", owner.userId);

if (ownerError) {
  throw new Error(`Owner SELECT failed: ${ownerError.message}`);
}

console.log(`Owner can SELECT own connections: ${ownerRows?.length ?? 0}`);

const ownerConnectionId = ownerRows?.[0]?.id;
if (!ownerConnectionId) {
  console.log("⏭️ Owner has no bank_connections rows; peer denial check skipped.");
  process.exit(0);
}

const { data: peerRows, error: peerError } = await peer.supabase
  .from("bank_connections")
  .select("id, user_id, institution_name, access_token_encrypted")
  .eq("id", ownerConnectionId);

if (peerError) {
  console.log("Peer SELECT returned error (acceptable denial):", peerError.message);
} else {
  assert.equal(
    peerRows?.length ?? 0,
    0,
    "Peer must not receive owner's bank_connections row",
  );
  console.log("✅ Peer SELECT returned zero rows for owner connection.");
}

const { data: peerNet, error: peerNetError } = await peer.supabase
  .from("bank_connections")
  .select("id")
  .eq("user_id", owner.userId);

assert.equal(peerNetError ? 0 : peerNet?.length ?? 0, 0, "Peer must not list owner connections");

console.log("✅ Authenticated owner/peer bank_connections boundary checks passed.");
