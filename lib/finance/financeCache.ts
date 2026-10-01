/**
 * Lightweight stale-while-revalidate cache for finance snapshots.
 * Never treats cached balances as authoritative without a refresh.
 */

import type { FinanceData } from "@/lib/finance/types";

const CACHE_PREFIX = "buxme-finance-cache-v1:";
const MAX_AGE_MS = 1000 * 60 * 30; // 30 minutes

export type CachedFinanceSnapshot = {
  savedAt: string;
  userId: string;
  data: FinanceData;
};

function storageKey(userId: string): string {
  return `${CACHE_PREFIX}${userId}`;
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
      return null;
    }

    const age = Date.now() - Date.parse(parsed.savedAt);
    if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeFinanceCache(userId: string, data: FinanceData): void {
  if (typeof window === "undefined") {
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
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(storageKey(userId));
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
