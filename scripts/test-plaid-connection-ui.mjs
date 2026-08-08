#!/usr/bin/env node
/**
 * Static + runtime checks for Connect Bank UI gating.
 * Usage: node scripts/test-plaid-connection-ui.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

// Source-level: Accounts must not always render BankSyncPlaceholder.
const accountsSrc = fs.readFileSync(
  path.join(ROOT, "components/accounts/AccountsContent.tsx"),
  "utf8",
);
assert.match(accountsSrc, /getPlaidConnectionUiState/);
assert.match(accountsSrc, /connection\.phase === "empty"/);
assert.doesNotMatch(
  accountsSrc,
  /<BankSyncPlaceholder \/>\s*\n\s*\{hiddenCount/,
);

const helperSrc = fs.readFileSync(
  path.join(ROOT, "lib/native/plaidConnectionUi.ts"),
  "utf8",
);
assert.match(helperSrc, /hasLinkedFinancialAccounts/);
assert.match(helperSrc, /never transaction/i);
assert.doesNotMatch(helperSrc, /transactions/);

console.log("✅ Connect Bank UI gating checks passed.");
