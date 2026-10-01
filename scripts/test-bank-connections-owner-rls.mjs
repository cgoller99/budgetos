#!/usr/bin/env node
/**
 * Stage 2.5: bank_connections must not be SELECT-able by household peers.
 *
 * Usage: npm run test:bank-connections-owner-rls
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const plaidMigration = read("supabase/migrations/20260704_plaid_integration.sql");
assert.match(
  plaidMigration,
  /Bank connections readable by household/,
  "historical migration should document the vulnerable policy that we remove",
);

const fix = read(
  "supabase/migrations/20261001_bank_connections_owner_only.sql",
);
assert.match(fix, /drop policy if exists "Bank connections readable by household"/);
assert.match(fix, /Bank connections manageable by owner/);
assert.match(fix, /auth\.uid\(\) = user_id/);
assert.doesNotMatch(
  fix,
  /household_id in \(select public\.user_household_ids\(\)\)/,
  "fix migration must not reintroduce household SELECT",
);

const feature = read("supabase/migrations/20260627_feature_expansion.sql");
assert.match(feature, /Bank connections manageable by owner/);

// App paths that touch bank_connections must scope by owning user id.
const repo = read("lib/supabase/repositories/bankConnectionsRepository.ts");
assert.match(repo, /listConnections[\s\S]*\.eq\("user_id", userId\)/);
assert.match(repo, /getConnectionById[\s\S]*\.eq\("user_id", userId\)/);
assert.match(repo, /BANK_CONNECTION_CLIENT_COLUMNS/);
assert.doesNotMatch(
  repo,
  /listConnections[\s\S]{0,250}\.select\("\*"\)/,
);

const sync = read("app/api/plaid/sync/route.ts");
assert.match(sync, /createSupabaseAdminClient/);

const webhook = read("app/api/plaid/webhook/route.ts");
assert.match(webhook, /createSupabaseAdminClient/);

const exchange = read("app/api/plaid/exchange/route.ts");
assert.match(exchange, /createSupabaseAdminClient/);
assert.match(exchange, /auth\.user\.id/);

const disconnect = read("app/api/plaid/disconnect/route.ts");
assert.match(disconnect, /getConnectionById/);
assert.match(disconnect, /auth\.user\.id/);

const accountDisconnect = read("app/api/accounts/disconnect-plaid/route.ts");
assert.match(accountDisconnect, /getConnectionById/);
assert.match(accountDisconnect, /auth\.user\.id/);

console.log("✅ Bank connections owner-only RLS regression checks passed.");
