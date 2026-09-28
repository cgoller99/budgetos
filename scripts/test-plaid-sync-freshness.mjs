/**
 * Focused regression tests for Plaid sync freshness decisions.
 * Covers the controllable delay root causes found in audit:
 * - user Sync now should request live balances + transactions/refresh
 * - webhook sync should NOT force a bank pull
 * - pending vs reconnect vs expiring classification for UI
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = "/tmp/plaid-sync-freshness-test.mjs";

execFileSync(
  path.join(ROOT, "node_modules/.bin/esbuild"),
  [
    path.join(ROOT, "lib/plaid/syncFreshness.ts"),
    "--bundle",
    "--platform=node",
    "--format=esm",
    `--outfile=${OUT}`,
  ],
  { stdio: "inherit" },
);

const {
  shouldUseLiveBalances,
  shouldRequestTransactionsRefresh,
  classifyConnectionFreshness,
  summarizeUserSyncResults,
  liveBalancesFromBalanceGet,
} = await import(pathToFileURL(OUT).href);

const syncService = fs.readFileSync(
  path.join(ROOT, "lib/plaid/syncService.ts"),
  "utf8",
);
const syncRoute = fs.readFileSync(
  path.join(ROOT, "app/api/plaid/sync/route.ts"),
  "utf8",
);
const webhookProcessor = fs.readFileSync(
  path.join(ROOT, "lib/plaid/webhookProcessor.ts"),
  "utf8",
);
const exchangeRoute = fs.readFileSync(
  path.join(ROOT, "app/api/plaid/exchange/route.ts"),
  "utf8",
);
const financeContext = fs.readFileSync(
  path.join(ROOT, "context/FinanceContext.tsx"),
  "utf8",
);

assert.match(
  syncService,
  /accountsBalanceGet/,
  "User-initiated sync must attempt live /accounts/balance/get",
);
assert.match(
  syncService,
  /preferLiveBalances:\s*shouldUseLiveBalances\(trigger\)/,
  "Live balances only for user/initial triggers",
);
assert.match(
  syncService,
  /shouldRequestTransactionsRefresh/,
  "transactions/refresh must be gated by sync trigger helper",
);
assert.match(
  syncRoute,
  /trigger:\s*"user"/,
  "POST /api/plaid/sync must mark sync as user-initiated",
);
assert.match(
  exchangeRoute,
  /trigger:\s*"initial"/,
  "Exchange initial sync must mark trigger=initial",
);
assert.match(
  webhookProcessor,
  /trigger:\s*"webhook"/,
  "Webhook sync must mark trigger=webhook (no forced bank pull)",
);
assert.match(
  webhookProcessor,
  /isExpiring \? "connected" : "error"/,
  "PENDING_EXPIRATION must not hard-error the connection",
);
assert.match(
  financeContext,
  /visibilitychange/,
  "FinanceContext must refetch when the tab becomes visible",
);

assert.equal(shouldUseLiveBalances("user"), true);
assert.equal(shouldUseLiveBalances("initial"), true);
assert.equal(shouldUseLiveBalances("webhook"), false);
assert.equal(liveBalancesFromBalanceGet("success"), true);
assert.equal(liveBalancesFromBalanceGet("failed"), false);
assert.equal(liveBalancesFromBalanceGet("skipped"), false);

assert.deepEqual(
  shouldRequestTransactionsRefresh({
    trigger: "user",
    hasCursor: true,
    hasNewAccounts: false,
  }),
  { request: true, skippedBecauseCooldown: false },
);
assert.deepEqual(
  shouldRequestTransactionsRefresh({
    trigger: "webhook",
    hasCursor: true,
    hasNewAccounts: false,
  }),
  { request: false, skippedBecauseCooldown: false },
);
assert.deepEqual(
  shouldRequestTransactionsRefresh({
    trigger: "user",
    hasCursor: true,
    hasNewAccounts: false,
    lastRefreshRequestedAt: new Date().toISOString(),
    nowMs: Date.now(),
  }),
  { request: false, skippedBecauseCooldown: true },
);

const refreshCalls = syncService.match(/await requestTransactionsRefresh\(/g) ?? [];
assert.equal(
  refreshCalls.length,
  1,
  "A single sync may call /transactions/refresh at most once",
);

assert.equal(
  classifyConnectionFreshness({
    status: "connected",
    errorCode: "BANK_REFRESH_PENDING",
    errorMessage: "Requested a fresh pull",
  }),
  "pending",
);
assert.equal(
  classifyConnectionFreshness({
    status: "connected",
    errorCode: "PENDING_EXPIRATION",
    errorMessage: "expires soon",
  }),
  "expiring",
);
assert.equal(
  classifyConnectionFreshness({
    status: "error",
    errorCode: "ITEM_LOGIN_REQUIRED",
    errorMessage: "reconnect",
  }),
  "reconnect",
);
assert.equal(
  classifyConnectionFreshness({
    status: "connected",
    errorCode: null,
    errorMessage: null,
  }),
  "healthy",
);

const pendingSummary = summarizeUserSyncResults([
  {
    connectionId: "c1",
    accountsSynced: 1,
    transactionsAdded: 0,
    transactionsModified: 0,
    transactionsRemoved: 0,
    investmentsSynced: 0,
    liabilitiesSynced: 0,
    diagnostics: {
      connectionId: "c1",
      itemId: "item",
      accounts: [],
      plaid: {
        fetchedFromPlaid: 0,
        addedFromPlaid: 0,
        modifiedFromPlaid: 0,
        removedFromPlaid: 0,
        pending: false,
        pendingError: null,
        refreshRequested: true,
        refreshUnavailable: false,
        refreshSkippedCooldown: false,
        liveBalances: false,
        syncAttempts: 1,
      },
      persisted: { inserted: 0, updated: 0, deleted: 0, skipped: [] },
      database: { transactionCountByAccountId: {} },
    },
  },
]);
assert.equal(pendingSummary.title, "Refresh requested");
assert.match(pendingSummary.subtitle, /few minutes/i);
assert.match(pendingSummary.subtitle, /cached copy/i);
assert.doesNotMatch(pendingSummary.subtitle, /checked with your bank/i);

const accountCard = fs.readFileSync(
  path.join(ROOT, "components/accounts/AccountCard.tsx"),
  "utf8",
);
const labelSource = fs.readFileSync(
  path.join(ROOT, "lib/plaid/formatSyncLabel.ts"),
  "utf8",
);
assert.match(labelSource, /Synced /);
assert.doesNotMatch(labelSource, /Updated /);
assert.match(accountCard, /formatAccountSyncLabel/);

console.log("✓ Plaid sync freshness regressions passed");
