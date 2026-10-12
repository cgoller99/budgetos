const STORAGE_KEY = "buxme-recurring-review-dismissals";

function storageKey(userId: string | null | undefined): string {
  return `${STORAGE_KEY}:${userId || "local"}`;
}

export function readRecurringReviewDismissals(
  userId: string | null | undefined,
): Record<string, string> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const stored = window.localStorage.getItem(storageKey(userId));
    if (!stored) {
      return {};
    }

    const parsed = JSON.parse(stored) as Record<string, string>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === "string" && typeof entry[1] === "string",
      ),
    );
  } catch {
    return {};
  }
}

export function writeRecurringReviewDismissal(
  userId: string | null | undefined,
  merchantKey: string,
  evidence: string,
): void {
  if (typeof window === "undefined" || !merchantKey.trim() || !evidence.trim()) {
    return;
  }

  const current = readRecurringReviewDismissals(userId);
  current[merchantKey] = evidence;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(current));
}
