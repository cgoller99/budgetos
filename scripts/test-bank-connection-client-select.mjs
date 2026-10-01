#!/usr/bin/env node
/**
 * Stage 2: bank_connections client list must not select token ciphertext columns.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(
  path.join(root, "lib/supabase/repositories/bankConnectionsRepository.ts"),
  "utf8",
);

assert.match(source, /BANK_CONNECTION_CLIENT_COLUMNS/);
assert.match(source, /\.select\(BANK_CONNECTION_CLIENT_COLUMNS\)/);
assert.doesNotMatch(
  source,
  /listConnections[\s\S]{0,400}\.select\("\*"\)/,
);

const columnsBlock = source.match(
  /BANK_CONNECTION_CLIENT_COLUMNS\s*=\s*`?["']([^"']+)["']/,
)?.[1];
assert.ok(columnsBlock, "client column allowlist should exist");
assert.doesNotMatch(columnsBlock, /access_token/);

console.log("✅ Bank connection client select hardening checks passed.");
