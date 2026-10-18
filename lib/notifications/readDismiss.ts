import {
  acknowledgeWeeklySummaryEvent,
  appendEvents,
  clearNotificationEvents,
  deleteEvent,
  deriveBillDueTomorrowEvents,
  deriveGoalReachedEvents,
  markAllEventsRead,
  markEventRead,
} from "@/lib/events/eventStore";
import type { FinanceEvent, FinanceEventType } from "@/lib/events/types";
import type { FinanceData } from "@/lib/finance/types";

export type NotificationIdentity = {
  id: string;
  eventType?: FinanceEventType;
  entityId?: string;
  title?: string;
  subtitle?: string;
  amount?: number;
  isVirtual?: boolean;
};

const VIRTUAL_BILL_PREFIX = "virtual-bill-due-";
const VIRTUAL_GOAL_PREFIX = "virtual-goal-reached-";

function createAckEvent(input: {
  type: FinanceEventType;
  label: string;
  description: string;
  icon: string;
  entityId?: string;
  entityType?: string;
  amount?: number;
  read: boolean;
  /** When false, suppresses regenerate without appearing in the panel. */
  keepInHistory: boolean;
}): FinanceEvent {
  return {
    id: crypto.randomUUID(),
    type: input.type,
    label: input.label,
    description: input.description,
    icon: input.icon,
    tone: "accent",
    surfaces: input.keepInHistory ? ["notification"] : ["activity"],
    entityId: input.entityId,
    entityType: input.entityType,
    amount: input.amount,
    timestamp: new Date().toISOString(),
    read: input.read,
  };
}

function isWeeklyVirtual(notification: NotificationIdentity): boolean {
  return (
    notification.eventType === "weekly_summary_ready" ||
    notification.id.startsWith("virtual-weekly-summary-") ||
    notification.id.includes("weekly") ||
    (notification.title ?? "").toLowerCase().includes("weekly summary")
  );
}

/**
 * Persist acknowledgment for a derived (virtual) notification so it stops
 * regenerating and no longer counts toward the unread badge.
 */
export function acknowledgeVirtualNotification(
  data: FinanceData,
  notification: NotificationIdentity,
  options?: { keepInHistory?: boolean },
): FinanceData {
  const keepInHistory = options?.keepInHistory ?? true;

  if (isWeeklyVirtual(notification)) {
    return acknowledgeWeeklySummaryEvent(data);
  }

  if (
    notification.id.startsWith(VIRTUAL_BILL_PREFIX) ||
    notification.eventType === "bill_due_tomorrow"
  ) {
    const entityId =
      notification.entityId ??
      notification.id.slice(VIRTUAL_BILL_PREFIX.length);
    const existing = (data.events ?? []).filter(
      (event) =>
        event.type === "bill_due_tomorrow" && event.entityId === entityId,
    );
    if (existing.length > 0) {
      return {
        ...data,
        events: (data.events ?? []).map((event) =>
          event.type === "bill_due_tomorrow" && event.entityId === entityId
            ? {
                ...event,
                read: true,
                surfaces: keepInHistory
                  ? event.surfaces.includes("notification")
                    ? event.surfaces
                    : [...event.surfaces, "notification"]
                  : event.surfaces.filter((surface) => surface !== "notification"),
              }
            : event,
        ),
      };
    }

    return appendEvents(data, [
      createAckEvent({
        type: "bill_due_tomorrow",
        label: notification.title ?? "Bill due tomorrow",
        description: notification.subtitle ?? "Reminder acknowledged.",
        icon: "📋",
        entityId,
        entityType: "bill",
        amount: notification.amount,
        read: true,
        keepInHistory,
      }),
    ]);
  }

  if (
    notification.id.startsWith(VIRTUAL_GOAL_PREFIX) ||
    notification.eventType === "goal_completed"
  ) {
    const entityId =
      notification.entityId ??
      notification.id.slice(VIRTUAL_GOAL_PREFIX.length);
    const existing = (data.events ?? []).filter(
      (event) => event.type === "goal_completed" && event.entityId === entityId,
    );
    if (existing.length > 0) {
      return {
        ...data,
        events: (data.events ?? []).map((event) =>
          event.type === "goal_completed" && event.entityId === entityId
            ? {
                ...event,
                read: true,
                surfaces: keepInHistory
                  ? event.surfaces.includes("notification")
                    ? event.surfaces
                    : [...event.surfaces, "notification"]
                  : event.surfaces.filter((surface) => surface !== "notification"),
              }
            : event,
        ),
      };
    }

    return appendEvents(data, [
      createAckEvent({
        type: "goal_completed",
        label: notification.title ?? "Goal reached",
        description: notification.subtitle ?? "Goal acknowledged.",
        icon: "🏆",
        entityId,
        entityType: "goal",
        read: true,
        keepInHistory,
      }),
    ]);
  }

  return data;
}

export function markNotificationReadInData(
  data: FinanceData,
  notification: NotificationIdentity | string,
): FinanceData {
  const identity: NotificationIdentity =
    typeof notification === "string" ? { id: notification } : notification;

  const stored = (data.events ?? []).find((event) => event.id === identity.id);
  if (stored) {
    return markEventRead(data, identity.id);
  }

  return acknowledgeVirtualNotification(
    data,
    { ...identity, isVirtual: true },
    { keepInHistory: true },
  );
}

/**
 * Mark every stored notification read and acknowledge currently derived virtuals.
 */
export function markAllNotificationsReadInData(data: FinanceData): FinanceData {
  let next = markAllEventsRead(data);
  next = acknowledgeWeeklySummaryEvent(next);

  for (const event of deriveBillDueTomorrowEvents(data)) {
    next = acknowledgeVirtualNotification(
      next,
      {
        id: event.id,
        eventType: event.type,
        entityId: event.entityId,
        title: event.label,
        subtitle: event.description,
        amount: event.amount,
        isVirtual: true,
      },
      { keepInHistory: true },
    );
  }

  for (const event of deriveGoalReachedEvents(data)) {
    next = acknowledgeVirtualNotification(
      next,
      {
        id: event.id,
        eventType: event.type,
        entityId: event.entityId,
        title: event.label,
        subtitle: event.description,
        isVirtual: true,
      },
      { keepInHistory: true },
    );
  }

  return next;
}

const SUPPRESSING_TYPES = new Set<FinanceEventType>([
  "weekly_summary_ready",
  "bill_due_tomorrow",
  "goal_completed",
]);

export function dismissNotificationFromData(
  data: FinanceData,
  notification: NotificationIdentity | string,
): FinanceData {
  const identity: NotificationIdentity =
    typeof notification === "string" ? { id: notification } : notification;

  const stored = (data.events ?? []).find((event) => event.id === identity.id);
  if (stored) {
    // Deleting suppressing acknowledgments would regenerate unread virtuals.
    // Strip the notification surface instead so history disappears but the
    // entity/week remains acknowledged.
    if (SUPPRESSING_TYPES.has(stored.type)) {
      return {
        ...data,
        events: (data.events ?? []).map((event) =>
          event.id === identity.id
            ? {
                ...event,
                read: true,
                surfaces: event.surfaces.filter(
                  (surface) => surface !== "notification",
                ),
              }
            : event,
        ),
      };
    }

    return deleteEvent(data, identity.id);
  }

  // Virtual dismiss: suppress regeneration without keeping panel history.
  return acknowledgeVirtualNotification(
    data,
    { ...identity, isVirtual: true },
    { keepInHistory: false },
  );
}

export function clearAllNotificationsInData(data: FinanceData): FinanceData {
  // Acknowledge virtuals first (suppress regenerate), then strip notification surfaces.
  let next = markAllNotificationsReadInData(data);
  next = clearNotificationEvents(next);
  return next;
}
