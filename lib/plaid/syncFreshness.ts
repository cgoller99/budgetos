import type { BankConnection } from "@/lib/finance/types";
import type { PlaidSyncResult } from "@/lib/plaid/types";

export type PlaidSyncTrigger = "webhook" | "user" | "initial";

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

export function shouldRequestTransactionsRefresh(params: {
  trigger: PlaidSyncTrigger;
  hasCursor: boolean;
  hasNewAccounts: boolean;
}): boolean {
  if (params.trigger === "user" || params.trigger === "initial") {
    return true;
  }

  // Webhook means Plaid already has updates ready — do not force another bank pull.
  return params.hasNewAccounts || !params.hasCursor;
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
  const liveBalances = results.some(
    (result) => result.diagnostics?.plaid.liveBalances === true,
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

  if (added > 0) {
    return {
      title: "Bank sync complete",
      subtitle: `Imported ${added} transaction${added === 1 ? "" : "s"}${
        liveBalances ? " and refreshed live balances" : ""
      }.`,
    };
  }

  if (pending || refreshRequested) {
    return {
      title: "Refresh requested",
      subtitle:
        "Balances were updated from Plaid. New transactions usually appear within a few minutes once your bank finishes updating.",
    };
  }

  if (modified > 0 || liveBalances) {
    return {
      title: "Balances updated",
      subtitle: liveBalances
        ? "Live balances were pulled from your bank. No new transactions yet."
        : "Account data was refreshed. No new transactions yet.",
    };
  }

  if (refreshUnavailable) {
    return {
      title: "Sync finished",
      subtitle:
        "Pulled the latest data Plaid already has. A forced bank refresh is not enabled for this Item.",
    };
  }

  return {
    title: "Sync finished",
    subtitle:
      "No new transactions yet. Banks often update on their own schedule — try again shortly.",
  };
}
