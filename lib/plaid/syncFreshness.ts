import type { BankConnection } from "@/lib/finance/types";
import type { PlaidSyncResult } from "@/lib/plaid/types";

export type PlaidSyncTrigger = "webhook" | "user" | "initial";

/** Minimum gap between billable /transactions/refresh calls for one Item. */
export const TRANSACTIONS_REFRESH_MIN_INTERVAL_MS = 15 * 60 * 1000;

export type ConnectionFreshnessKind =
  | "healthy"
  | "pending"
  | "reconnect"
  | "expiring";

const PENDING_CODES = new Set([
  "TRANSACTIONS_PENDING",
  "BANK_REFRESH_PENDING",
  "PRODUCT_NOT_READY",
]);

const RECONNECT_CODES = new Set([
  "ITEM_LOGIN_REQUIRED",
  "USER_PERMISSION_REVOKED",
  "ACCESS_NOT_GRANTED",
  "ERROR",
]);

export function shouldUseLiveBalances(trigger: PlaidSyncTrigger): boolean {
  return trigger === "user" || trigger === "initial";
}

export function isTransactionsRefreshCoolingDown(params: {
  lastRefreshRequestedAt?: string | null;
  nowMs?: number;
}): boolean {
  if (!params.lastRefreshRequestedAt) {
    return false;
  }

  const requestedAt = Date.parse(params.lastRefreshRequestedAt);

  if (Number.isNaN(requestedAt)) {
    return false;
  }

  return (
    (params.nowMs ?? Date.now()) - requestedAt <
    TRANSACTIONS_REFRESH_MIN_INTERVAL_MS
  );
}

/**
 * At most one /transactions/refresh per sync, and not again until the cooldown
 * elapses. Webhook syncs with an existing cursor do not refresh: Plaid already
 * has updates ready, and refresh does not make /transactions/sync contact the bank.
 */
export function shouldRequestTransactionsRefresh(params: {
  trigger: PlaidSyncTrigger;
  hasCursor: boolean;
  hasNewAccounts: boolean;
  lastRefreshRequestedAt?: string | null;
  nowMs?: number;
}): { request: boolean; skippedBecauseCooldown: boolean } {
  const wantsRefresh =
    params.trigger === "user" ||
    params.trigger === "initial" ||
    params.hasNewAccounts ||
    !params.hasCursor;

  if (!wantsRefresh) {
    return { request: false, skippedBecauseCooldown: false };
  }

  if (
    isTransactionsRefreshCoolingDown({
      lastRefreshRequestedAt: params.lastRefreshRequestedAt,
      nowMs: params.nowMs,
    })
  ) {
    return { request: false, skippedBecauseCooldown: true };
  }

  return { request: true, skippedBecauseCooldown: false };
}

/** True only when /accounts/balance/get itself succeeded. */
export function liveBalancesFromBalanceGet(
  outcome: "success" | "failed" | "skipped",
): boolean {
  return outcome === "success";
}

export function classifyConnectionFreshness(
  connection: Pick<BankConnection, "status" | "errorCode" | "errorMessage">,
): ConnectionFreshnessKind {
  const code = (connection.errorCode ?? "").toUpperCase();
  const message = (connection.errorMessage ?? "").toLowerCase();

  if (code === "PENDING_EXPIRATION") {
    return "expiring";
  }

  if (PENDING_CODES.has(code)) {
    return "pending";
  }

  if (
    connection.status === "error" ||
    RECONNECT_CODES.has(code) ||
    code.includes("LOGIN_REQUIRED") ||
    message.includes("login required") ||
    (message.includes("reconnect") && !PENDING_CODES.has(code))
  ) {
    return "reconnect";
  }

  return "healthy";
}

export function summarizeUserSyncResults(results: PlaidSyncResult[]): {
  title: string;
  subtitle: string;
} {
  const added = results.reduce(
    (sum, result) =>
      sum +
      result.transactionsAdded +
      (result.diagnostics?.backfill?.inserted ?? 0),
    0,
  );
  const modified = results.reduce(
    (sum, result) => sum + result.transactionsModified,
    0,
  );
  const refreshRequested = results.some(
    (result) => result.diagnostics?.plaid.refreshRequested === true,
  );
  const pending = results.some(
    (result) => result.diagnostics?.plaid.pending === true,
  );
  const refreshUnavailable = results.some(
    (result) => result.diagnostics?.plaid.refreshUnavailable === true,
  );
  const refreshCoolingDown = results.some(
    (result) => result.diagnostics?.plaid.refreshSkippedCooldown === true,
  );
  const attemptedLive = results.filter(
    (result) => result.diagnostics?.plaid.liveBalances !== undefined,
  );
  const allLive =
    attemptedLive.length > 0 &&
    attemptedLive.every((result) => result.diagnostics?.plaid.liveBalances === true);
  const balanceNote = allLive
    ? "Balances were checked with your bank."
    : "Balances shown are Plaid's cached copy — the bank was not checked just now.";

  if (added > 0) {
    return {
      title: "Bank sync complete",
      subtitle: `Imported ${added} transaction${added === 1 ? "" : "s"}. ${balanceNote}`,
    };
  }

  if (refreshCoolingDown && !refreshRequested) {
    return {
      title: "Sync finished",
      subtitle: `A bank refresh was already requested in the last 15 minutes. ${balanceNote}`,
    };
  }

  if (pending || refreshRequested) {
    return {
      title: "Refresh requested",
      subtitle: `Asked your bank for newer transactions. They usually appear within a few minutes. ${balanceNote}`,
    };
  }

  if (modified > 0 || allLive) {
    return {
      title: allLive ? "Balances checked" : "Sync finished",
      subtitle: allLive
        ? "Balances were checked with your bank. No new transactions yet."
        : `Saved the latest transactions Plaid already had. ${balanceNote}`,
    };
  }

  if (refreshUnavailable) {
    return {
      title: "Sync finished",
      subtitle: `A forced bank refresh is not enabled for this connection. ${balanceNote}`,
    };
  }

  return {
    title: "Sync finished",
    subtitle:
      "No new transactions yet. Banks often update on their own schedule — try again shortly.",
  };
}
