import {
  deriveBillDueTomorrowEvents,
  deriveGoalReachedEvents,
  deriveWeeklySummaryEvent,
} from "@/lib/events/eventStore";
import type {
  ActivityItem,
  FinanceEvent,
  FinanceEventSurface,
  NotificationItem,
} from "@/lib/events/types";
import type { FinanceData } from "@/lib/finance/types";
import {
  getNotificationPreferences,
  type NotificationCategory,
} from "@/lib/notifications/preferences";

function hasSurface(event: FinanceEvent, surface: FinanceEventSurface): boolean {
  return Array.isArray(event.surfaces) && event.surfaces.includes(surface);
}

function getEventCategory(event: FinanceEvent): NotificationCategory | null {
  switch (event.type) {
    case "bill_due_tomorrow":
    case "bill_paid":
    case "bill_added":
      return "bills";
    case "goal_completed":
    case "goal_contribution":
    case "goal_created":
      return "goals";
    case "household_invite_accepted":
      return "household";
    case "weekly_summary_ready":
      return "weeklySummary";
    default:
      return null;
  }
}

function isCategoryEnabled(event: FinanceEvent): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  const category = getEventCategory(event);

  if (!category) {
    return true;
  }

  return getNotificationPreferences()[category];
}

function toActivityItem(event: FinanceEvent): ActivityItem {
  return {
    id: event.id,
    label: event.label ?? "Activity",
    description: event.description ?? "",
    icon: event.icon ?? "✓",
    tone: event.tone ?? "neutral",
    timestamp: event.timestamp ?? new Date().toISOString(),
  };
}

function toNotificationItem(event: FinanceEvent): NotificationItem {
  const description = event.description ?? "";
  const label = event.label ?? "Notification";
  const isCheckmarkTitle = description.startsWith("✓");

  return {
    id: event.id,
    title: isCheckmarkTitle ? description : label,
    subtitle: isCheckmarkTitle ? label : description,
    icon: event.icon,
    tone: event.tone,
    timestamp: event.timestamp,
    read: event.read,
  };
}

function getVirtualNotifications(data: FinanceData): NotificationItem[] {
  const virtualEvents: FinanceEvent[] = [];

  const weeklySummary = deriveWeeklySummaryEvent(data);
  if (weeklySummary) {
    virtualEvents.push({ ...weeklySummary, read: false });
  }

  virtualEvents.push(...deriveBillDueTomorrowEvents(data));
  virtualEvents.push(...deriveGoalReachedEvents(data));

  return virtualEvents
    .filter((event) => isCategoryEnabled(event))
    .map((event) => toNotificationItem(event));
}

export function getNotifications(data: FinanceData): NotificationItem[] {
  const events = data.events ?? [];
  const stored = events
    .filter(
      (event) => hasSurface(event, "notification") && isCategoryEnabled(event),
    )
    .slice(0, 20)
    .map(toNotificationItem);

  const virtual = getVirtualNotifications(data).filter(
    (item) =>
      !stored.some(
        (storedItem) =>
          storedItem.title.includes("Weekly Summary") &&
          item.title.includes("Weekly Summary"),
      ),
  );

  return [...virtual, ...stored];
}

export function getUnreadNotificationCount(data: FinanceData): number {
  const events = data.events ?? [];
  const storedUnread = events.filter(
    (event) =>
      hasSurface(event, "notification") &&
      !event.read &&
      isCategoryEnabled(event),
  ).length;

  const virtualUnread = getVirtualNotifications(data).length;

  return storedUnread + virtualUnread;
}

export function getRecentActivity(
  data: FinanceData,
  limit = 8,
): ActivityItem[] {
  return (data.events ?? [])
    .filter((event) => hasSurface(event, "activity"))
    .slice(0, limit)
    .map(toActivityItem);
}

export function getReportEvents(
  data: FinanceData,
  limit = 12,
): ActivityItem[] {
  return (data.events ?? [])
    .filter((event) => hasSurface(event, "report"))
    .slice(0, limit)
    .map(toActivityItem);
}

export function getRoadmapEvents(
  data: FinanceData,
  limit = 6,
): ActivityItem[] {
  return (data.events ?? [])
    .filter((event) => hasSurface(event, "roadmap"))
    .slice(0, limit)
    .map(toActivityItem);
}

export function formatEventTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
