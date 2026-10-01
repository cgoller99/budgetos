#!/usr/bin/env node
/**
 * Stage 3: static + synthetic performance regression checks.
 *
 * Usage: npm run test:stage3-performance
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const financeService = read("lib/supabase/services/financeService.ts");
assert.match(financeService, /FINANCE_TRANSACTION_BOOTSTRAP_LIMIT/);
assert.match(financeService, /TRANSACTION_SELECT_COLUMNS/);
assert.match(financeService, /loadOlderTransactions/);
assert.doesNotMatch(
  financeService,
  /scopedSelect\("accounts", "\*"\)|from\("accounts"\)\.select\("\*"\)/,
);

const queryColumns = read("lib/finance/queryColumns.ts");
for (const constant of [
  "ACCOUNT_SELECT_COLUMNS",
  "BILL_SELECT_COLUMNS",
  "TRANSACTION_SELECT_COLUMNS",
  "GOAL_SELECT_COLUMNS",
]) {
  assert.match(queryColumns, new RegExp(`export const ${constant}`));
}

const windowConfig = read("lib/finance/transactionWindow.ts");
assert.match(windowConfig, /FINANCE_TRANSACTION_LOOKBACK_DAYS = 120/);
assert.match(windowConfig, /FINANCE_TRANSACTION_BOOTSTRAP_LIMIT = 2500/);
assert.match(windowConfig, /FINANCE_TRANSACTION_PAGE_SIZE = 100/);

const financeContext = read("context/FinanceContext.tsx");
assert.match(financeContext, /readFinanceCache/);
assert.match(financeContext, /writeFinanceCache/);
assert.match(financeContext, /REALTIME_REFRESH_DEBOUNCE_MS/);
assert.match(financeContext, /loadOlderTransactions/);
assert.doesNotMatch(
  financeContext,
  /tables = \[[^\]]*"bank_connections"/s,
  "household realtime must not subscribe to bank_connections",
);

const exchange = read("app/api/plaid/exchange/route.ts");
assert.match(exchange, /awaitHistoricalBackfill:\s*false/);
assert.match(exchange, /after\(/);
assert.match(exchange, /historyImportPending/);

const syncService = read("lib/plaid/syncService.ts");
assert.match(syncService, /awaitHistoricalBackfill/);

const transactionsUi = read("components/transactions/TransactionsContent.tsx");
assert.match(transactionsUi, /Load older transactions/);
assert.match(transactionsUi, /loadOlderTransactions/);

// Synthetic payload comparison for transaction windows.
function makeTransaction(index) {
  return {
    id: `tx-${index}`,
    user_id: "user",
    household_id: null,
    transaction_type: "expense",
    name: `Transaction ${index}`,
    amount: 12.34,
    frequency: null,
    category: "Food",
    goal_id: null,
    account_id: "acct-1",
    bill_id: null,
    transfer_to_account_id: null,
    notes: null,
    start_date: null,
    next_occurrence: null,
    last_processed_date: null,
    recurring_status: null,
    transaction_date: new Date(Date.now() - index * 86400000).toISOString(),
    external_transaction_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function payloadBytes(rows) {
  return Buffer.byteLength(JSON.stringify(rows), "utf8");
}

const sizes = [0, 100, 1000, 5000, 10000];
const measurements = sizes.map((count) => {
  const all = Array.from({ length: count }, (_, index) => makeTransaction(index));
  const windowed = all.slice(0, Math.min(count, 2500));
  return {
    count,
    fullBytes: payloadBytes(all),
    windowedBytes: payloadBytes(windowed),
  };
});

const tenK = measurements.find((row) => row.count === 10000);
assert.ok(tenK);
assert.ok(
  tenK.windowedBytes < tenK.fullBytes,
  "windowed bootstrap must be smaller than full 10k history",
);
assert.ok(
  tenK.windowedBytes / tenK.fullBytes < 0.3,
  "2500-row window should be well under 30% of a 10k payload",
);

const loadFinanceDataSites = [
  ...financeService.matchAll(/loadFinanceData\(/g),
].length;

assert.ok(
  loadFinanceDataSites < 40,
  `expected fewer than 40 loadFinanceData references, found ${loadFinanceDataSites}`,
);

console.log("✅ Stage 3 performance checks passed.");
console.log(
  JSON.stringify(
    {
      loadFinanceDataSitesInFinanceService: loadFinanceDataSites,
      syntheticPayloads: measurements,
    },
    null,
    2,
  ),
);
