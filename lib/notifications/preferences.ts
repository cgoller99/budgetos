export type NotificationCategory =
  | "bills"
  | "goals"
  | "household"
  | "weeklySummary";

export type NotificationPreferences = Record<NotificationCategory, boolean>;

const STORAGE_KEY = "buxme-notification-preferences";

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  bills: true,
  goals: true,
  household: true,
  weeklySummary: true,
};

export function getNotificationPreferences(): NotificationPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return DEFAULT_NOTIFICATION_PREFERENCES;
    }

    const parsed = JSON.parse(stored) as Partial<NotificationPreferences>;

    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...parsed,
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

export function setNotificationPreferences(
  preferences: NotificationPreferences,
): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

export function isNotificationCategoryEnabled(
  category: NotificationCategory,
): boolean {
  return getNotificationPreferences()[category];
}
