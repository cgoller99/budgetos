import type { Account } from "@/lib/finance/types";

const STALE_MS = 7 * 24 * 60 * 60 * 1000;

/** Human-readable bank account label for pickers and cards. Uses stable IDs elsewhere. */
export function formatBankAccountLabel(account: Account): string {
  const displayName = (account.nickname?.trim() || account.name).trim();
  const institution = account.institution?.trim();
  const lastFour = account.lastFour?.replace(/\D/g, "").slice(-4);
  const parts = [displayName];
  if (institution && !displayName.toLowerCase().includes(institution.toLowerCase())) {
    parts.push(institution);
  }
  if (lastFour) {
    parts.push(`···${lastFour}`);
  }
  return parts.join(" · ");
}

export function formatBankAccountShort(account: Account): string {
  const displayName = (account.nickname?.trim() || account.name).trim();
  const lastFour = account.lastFour?.replace(/\D/g, "").slice(-4);
  return lastFour ? `${displayName} ···${lastFour}` : displayName;
}

export function isBalanceStale(
  lastSyncedAt: string | null | undefined,
  referenceDate = new Date(),
): boolean {
  if (!lastSyncedAt) return true;
  const synced = new Date(lastSyncedAt);
  if (Number.isNaN(synced.getTime())) return true;
  return referenceDate.getTime() - synced.getTime() > STALE_MS;
}

export function formatBalanceFreshness(
  lastSyncedAt: string | null | undefined,
  referenceDate = new Date(),
): { label: string; stale: boolean } {
  const stale = isBalanceStale(lastSyncedAt, referenceDate);
  if (!lastSyncedAt) {
    return { label: "Manual balance — sync date unknown", stale: true };
  }
  const synced = new Date(lastSyncedAt);
  if (Number.isNaN(synced.getTime())) {
    return { label: "Balance date unknown", stale: true };
  }
  const label = synced.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return {
    label: stale ? `Last synced ${label} — may be out of date` : `Synced ${label}`,
    stale,
  };
}

/** Eligible planning destinations — owner data only; never credit cards. */
export function eligibleLinkAccounts(accounts: Account[]): Account[] {
  return accounts.filter(
    (account) =>
      !account.isHidden &&
      !account.archivedAt &&
      account.type !== "credit_card",
  );
}
