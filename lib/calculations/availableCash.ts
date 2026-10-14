import { isAccountIncludedInSafeToSpend } from "@/lib/finance/accountPreferences";
import { isCashAccountType } from "@/lib/finance/accountTypes";
import type { Account, FinanceData } from "@/lib/finance/types";

const STALE_SYNC_MS = 7 * 24 * 60 * 60 * 1000;

export type CashAvailabilityStatus = "known" | "qualified" | "unavailable";

export type CashAvailability = {
  status: CashAvailabilityStatus;
  /** Spendable cash used as an STS ceiling when status is known or qualified. */
  amount: number;
  reason: string | null;
  accountCount: number;
};

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Checking and cash are spendable when STS-included.
 * Savings are spendable only when the user explicitly opted in
 * (`includeInSafeToSpend === true`), never by default.
 */
export function isSpendableSafeToSpendAccount(account: Account): boolean {
  if (!isAccountIncludedInSafeToSpend(account)) {
    return false;
  }

  if (account.type === "checking" || account.type === "cash") {
    return true;
  }

  if (account.type === "savings") {
    return account.includeInSafeToSpend === true;
  }

  return false;
}

function accountBalanceSample(account: Account): {
  amount: number;
  known: boolean;
  stale: boolean;
} {
  const available =
    account.availableBalance !== null &&
    account.availableBalance !== undefined &&
    Number.isFinite(account.availableBalance)
      ? account.availableBalance
      : null;

  const current = Number.isFinite(account.balance) ? account.balance : null;

  let amount = 0;
  let known = false;

  if (available !== null) {
    amount = Math.max(available, 0);
    known = true;
  } else if (current !== null) {
    amount = Math.max(current, 0);
    // Manual accounts without availableBalance are still usable, but qualified.
    known = Boolean(account.externalAccountId) || account.type === "cash";
  }

  let stale = false;
  if (account.externalAccountId && account.lastSyncedAt) {
    const synced = Date.parse(account.lastSyncedAt);
    if (Number.isFinite(synced) && Date.now() - synced > STALE_SYNC_MS) {
      stale = true;
    }
  } else if (account.externalAccountId && !account.lastSyncedAt) {
    stale = true;
  }

  return { amount, known, stale };
}

/**
 * Dedupes Plaid duplicates (same externalAccountId) and prefers the
 * higher known available/current sample so mixed manual/Plaid mirrors
 * of one account are not double-counted.
 */
function uniqueSpendableAccounts(data: FinanceData): Account[] {
  const selected: Account[] = [];
  const seenExternal = new Set<string>();
  const seenIds = new Set<string>();

  for (const account of data.accounts ?? []) {
    if (!isSpendableSafeToSpendAccount(account)) {
      continue;
    }
    if (seenIds.has(account.id)) {
      continue;
    }
    if (account.externalAccountId) {
      if (seenExternal.has(account.externalAccountId)) {
        continue;
      }
      seenExternal.add(account.externalAccountId);
    }
    seenIds.add(account.id);
    selected.push(account);
  }

  return selected;
}

/**
 * Spendable cash from STS-included checking/cash (and explicitly opted-in savings).
 * Prefers Plaid available balance when present; falls back to current balance.
 * Negative balances contribute $0 (they do not invent spendable cash).
 */
export function calculateAvailableCash(data: FinanceData): number {
  return resolveCashAvailability(data).amount;
}

export function resolveCashAvailability(data: FinanceData): CashAvailability {
  const accounts = uniqueSpendableAccounts(data);

  if (accounts.length === 0) {
    return {
      status: "unavailable",
      amount: 0,
      reason:
        "No spendable checking/cash balances are included in Safe to Spend. Add a cash account or include one before trusting the income-based estimate.",
      accountCount: 0,
    };
  }

  const samples = accounts.map(accountBalanceSample);
  const amount = roundCurrency(sum(samples.map((sample) => sample.amount)));
  const anyUnknown = samples.some((sample) => !sample.known);
  const anyStale = samples.some((sample) => sample.stale);
  const onlyManual = accounts.every((account) => !account.externalAccountId);

  if (anyUnknown) {
    return {
      status: "qualified",
      amount,
      reason:
        "Some balances lack a confirmed available amount, so Safe to Spend is capped to a qualified cash estimate.",
      accountCount: accounts.length,
    };
  }

  if (anyStale) {
    return {
      status: "qualified",
      amount,
      reason:
        "At least one linked cash balance is stale, so Safe to Spend uses a qualified cash ceiling.",
      accountCount: accounts.length,
    };
  }

  if (onlyManual) {
    return {
      status: "qualified",
      amount,
      reason:
        "Safe to Spend is capped to your entered cash balances (manual accounts).",
      accountCount: accounts.length,
    };
  }

  return {
    status: "known",
    amount,
    reason: null,
    accountCount: accounts.length,
  };
}

/** @deprecated Prefer resolveCashAvailability / hasSpendableCashAccounts. */
export function hasPlaidLinkedCashAccounts(data: FinanceData): boolean {
  return (data.accounts ?? []).some(
    (account) =>
      Boolean(account.externalAccountId) &&
      isCashAccountType(account.type) &&
      isAccountIncludedInSafeToSpend(account),
  );
}

export function hasSpendableCashAccounts(data: FinanceData): boolean {
  return uniqueSpendableAccounts(data).length > 0;
}
