const STORAGE_KEY = "buxme-automation-dismissed";

function readDismissedIds(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return new Set();
    }

    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

export function getDismissedAutomationIds(): Set<string> {
  return readDismissedIds();
}

export function dismissAutomationSuggestion(id: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const dismissed = readDismissedIds();
  dismissed.add(id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed]));
}

export function isAutomationSuggestionDismissed(id: string): boolean {
  return readDismissedIds().has(id);
}
