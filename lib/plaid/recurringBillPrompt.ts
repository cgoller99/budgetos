const SNOOZE_STORAGE_KEY = "buxme-recurring-bills-snooze-until";
const SNOOZE_MS = 24 * 60 * 60 * 1000;

export function isRecurringBillsPromptSnoozed(now = Date.now()): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const raw = window.localStorage.getItem(SNOOZE_STORAGE_KEY);

  if (!raw) {
    return false;
  }

  const snoozeUntil = Date.parse(raw);
  return Number.isFinite(snoozeUntil) && snoozeUntil > now;
}

export function snoozeRecurringBillsPrompt(now = Date.now()): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    SNOOZE_STORAGE_KEY,
    new Date(now + SNOOZE_MS).toISOString(),
  );
}

export function clearRecurringBillsPromptSnooze(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SNOOZE_STORAGE_KEY);
}
