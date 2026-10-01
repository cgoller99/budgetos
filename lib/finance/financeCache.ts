/**
 * Lightweight stale-while-revalidate cache for finance snapshots.
 * Never treats cached balances as authoritative without a refresh.
 *
 * Isolation rules:
 * - Keys are always user-scoped (`buxme-finance-cache-v1:{userId}`)
 * - Reads refuse mismatched userId payloads
 * - Logout / user-switch must clear ALL finance cache keys
 */

import type { FinanceData } from "@/lib/finance/types";

export const FINANCE_CACHE_PREFIX = "buxme-finance-cache-v1:";
const MAX_AGE_MS = 1000 * 60 * 30; // 30 minutes

export type CachedFinanceSnapshot = {
  savedAt: string;
  userId: string;
  data: FinanceData;
};

function storageKey(userId: string): string {
  return `${FINANCE_CACHE_PREFIX}${userId}`;
}

export function readFinanceCache(userId: string): CachedFinanceSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(storageKey(userId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CachedFinanceSnapshot;
    if (!parsed?.savedAt || parsed.userId !== userId || !parsed.data) {
      window.sessionStorage.removeItem(storageKey(userId));
      return null;
    }

    const age = Date.now() - Date.parse(parsed.savedAt);
    if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) {
      window.sessionStorage.removeItem(storageKey(userId));
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeFinanceCache(userId: string, data: FinanceData): void {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  try {
    const payload: CachedFinanceSnapshot = {
      savedAt: new Date().toISOString(),
      userId,
      data,
    };
    window.sessionStorage.setItem(storageKey(userId), JSON.stringify(payload));
  } catch {
    // Quota / private mode — ignore.
  }
}

export function clearFinanceCache(userId: string): void {
  if (typeof window === "undefined" || !userId) {
    return;
  }

  try {
    window.sessionStorage.removeItem(storageKey(userId));
  } catch {
    // ignore
  }
}

/** Clears every finance SWR entry for this browser tab (logout / user switch). */
export function clearAllFinanceCaches(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const keysToRemove: string[] = [];
    for (let index = 0; index < window.sessionStorage.length; index += 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(FINANCE_CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // ignore
  }
}

export function getFinanceCacheAgeLabel(savedAt: string, now = Date.now()): string {
  const ageMs = Math.max(0, now - Date.parse(savedAt));
  const minutes = Math.round(ageMs / 60000);
  if (minutes <= 0) {
    return "Just now";
  }
  if (minutes === 1) {
    return "1 minute ago";
  }
  if (minutes < 60) {
    return `${minutes} minutes ago`;
  }
  const hours = Math.round(minutes / 60);
  return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}
