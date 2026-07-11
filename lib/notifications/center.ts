import type { FinanceEventType } from "@/lib/events/types";
import type { NotificationItem } from "@/lib/events/types";
import { buildTransactionsHref } from "@/lib/transactions/filterParams";

export type NotificationCategory =
  | "bill_due"
  | "income_received"
  | "paycheck_incoming"
  | "plaid_sync_complete"
  | "plaid_sync_failed"
  | "new_transactions"
  | "goal_milestone"
  | "budget_alert"
  | "safe_to_spend"
  | "subscription"
  | "household"
  | "system"
  | "security"
  | "automation"
  | "general";

export type NotificationGroupKey = "today" | "yesterday" | "this_week" | "earlier";

export type EnrichedNotification = NotificationItem & {
  category: NotificationCategory;
  href?: string;
  isVirtual?: boolean;
};

const CATEGORY_META: Record<
  NotificationCategory,
  { icon: string; accentClass: string; bgClass: string }
> = {
  bill_due: {
    icon: "📄",
    accentClass: "text-amber-300",
    bgClass: "bg-amber-500/10",
  },
  income_received: {
    icon: "💰",
    accentClass: "text-emerald-300",
    bgClass: "bg-emerald-500/10",
  },
  paycheck_incoming: {
    icon: "💵",
    accentClass: "text-[#4da3ff]",
    bgClass: "bg-[#0077ed]/10",
  },
  plaid_sync_complete: {
    icon: "🏦",
    accentClass: "text-emerald-300",
    bgClass: "bg-emerald-500/10",
  },
  plaid_sync_failed: {
    icon: "⚠️",
    accentClass: "text-rose-300",
    bgClass: "bg-rose-500/10",
  },
  new_transactions: {
    icon: "💳",
    accentClass: "text-[#4da3ff]",
    bgClass: "bg-[#0077ed]/10",
  },
  goal_milestone: {
    icon: "🎯",
    accentClass: "text-emerald-300",
    bgClass: "bg-emerald-500/10",
  },
  budget_alert: {
    icon: "📊",
    accentClass: "text-amber-300",
    bgClass: "bg-amber-500/10",
  },
  safe_to_spend: {
    icon: "🛡️",
    accentClass: "text-amber-300",
    bgClass: "bg-amber-500/10",
  },
  subscription: {
    icon: "⭐",
    accentClass: "text-[#4da3ff]",
    bgClass: "bg-[#0077ed]/10",
  },
  household: {
    icon: "👥",
    accentClass: "text-[#4da3ff]",
    bgClass: "bg-[#0077ed]/10",
  },
  system: {
    icon: "✨",
    accentClass: "text-[var(--foreground)]",
    bgClass: "bg-[var(--surface-hover)]",
  },
  security: {
    icon: "🔒",
    accentClass: "text-rose-300",
    bgClass: "bg-rose-500/10",
  },
  automation: {
    icon: "🤖",
    accentClass: "text-[#4da3ff]",
    bgClass: "bg-[#0077ed]/10",
  },
  general: {
    icon: "🔔",
    accentClass: "text-[var(--text-secondary)]",
    bgClass: "bg-[var(--surface-hover)]",
  },
};

export function getNotificationCategoryMeta(category: NotificationCategory) {
  return CATEGORY_META[category];
}

function inferCategoryFromEventType(type?: FinanceEventType): NotificationCategory {
  switch (type) {
    case "bill_due_tomorrow":
    case "bill_paid":
    case "bill_added":
    case "bill_updated":
    case "bill_deleted":
      return "bill_due";
    case "income_added":
      return "income_received";
    case "paycheck_processed":
      return "paycheck_incoming";
    case "transaction_added":
    case "transaction_updated":
    case "transaction_deleted":
      return "new_transactions";
    case "goal_completed":
    case "goal_contribution":
    case "goal_created":
    case "goal_updated":
      return "goal_milestone";
    case "net_worth_milestone":
      return "budget_alert";
    case "weekly_summary_ready":
      return "safe_to_spend";
    case "household_invite_accepted":
      return "household";
    case "account_added":
      return "plaid_sync_complete";
    case "debt_added":
    case "debt_payment":
      return "budget_alert";
    case "activity_applied":
      return "system";
    default:
      return "general";
  }
}

export function inferNotificationCategory(notification: NotificationItem): NotificationCategory {
  if (notification.automationSuggestionId) {
    if (notification.title.toLowerCase().includes("paycheck")) {
      return "paycheck_incoming";
    }
    if (notification.title.toLowerCase().includes("recurring")) {
      return "bill_due";
    }
    return "automation";
  }

  if (notification.id.startsWith("release-")) {
    return "system";
  }

  const eventType = notification.eventType;
  if (eventType) {
    return inferCategoryFromEventType(eventType);
  }

  const haystack = `${notification.title} ${notification.subtitle}`.toLowerCase();

  if (haystack.includes("plaid") && haystack.includes("fail")) return "plaid_sync_failed";
  if (haystack.includes("plaid") || haystack.includes("bank")) return "plaid_sync_complete";
  if (haystack.includes("bill") || haystack.includes("due")) return "bill_due";
  if (haystack.includes("paycheck") || haystack.includes("income plan")) return "paycheck_incoming";
  if (haystack.includes("income") || haystack.includes("paycheck")) return "income_received";
  if (haystack.includes("transaction")) return "new_transactions";
  if (haystack.includes("goal")) return "goal_milestone";
  if (haystack.includes("safe to spend")) return "safe_to_spend";
  if (haystack.includes("household")) return "household";
  if (haystack.includes("subscription") || haystack.includes("billing")) return "subscription";
  if (haystack.includes("security")) return "security";

  return "general";
}

export function resolveNotificationHref(notification: NotificationItem): string | undefined {
  if (notification.detailHref) {
    return notification.detailHref;
  }

  switch (notification.entityType) {
    case "bill":
      return notification.entityId ? `/bills` : "/bills";
    case "transaction":
      return notification.entityId
        ? buildTransactionsHref({
            transactionId: notification.entityId,
            filterLabel: notification.title,
          })
        : "/transactions";
    case "income":
    case "paycheck":
      return "/income";
    case "goal":
      return notification.entityId ? `/savings` : "/savings";
    case "account":
      return "/accounts";
    case "household":
      return "/settings#household";
    case "subscription":
      return "/settings";
    default:
      break;
  }

  const category = inferNotificationCategory(notification);

  switch (category) {
    case "bill_due":
      return "/bills";
    case "income_received":
    case "paycheck_incoming":
      return "/income";
    case "plaid_sync_complete":
    case "plaid_sync_failed":
      return "/accounts";
    case "new_transactions":
      return "/transactions";
    case "goal_milestone":
      return "/savings";
    case "household":
      return "/settings#household";
    case "subscription":
      return "/settings";
    case "safe_to_spend":
    case "budget_alert":
      return "/dashboard";
    default:
      return undefined;
  }
}

export function enrichNotification(
  notification: NotificationItem,
  options?: { isVirtual?: boolean },
): EnrichedNotification {
  const category = notification.category ?? inferNotificationCategory(notification);
  const meta = getNotificationCategoryMeta(category);

  return {
    ...notification,
    category,
    icon: notification.icon || meta.icon,
    href: resolveNotificationHref(notification),
    isVirtual: options?.isVirtual,
  };
}

export function dedupeNotifications(notifications: NotificationItem[]): NotificationItem[] {
  const seen = new Set<string>();

  return notifications.filter((notification) => {
    if (seen.has(notification.id)) {
      return false;
    }

    seen.add(notification.id);
    return true;
  });
}

export function filterNotifications(
  notifications: EnrichedNotification[],
  query: string,
): EnrichedNotification[] {
  const trimmed = query.trim().toLowerCase();

  if (!trimmed) {
    return notifications;
  }

  return notifications.filter((notification) => {
    const haystack = `${notification.title} ${notification.subtitle} ${notification.category}`.toLowerCase();
    return haystack.includes(trimmed);
  });
}

export function sortNotificationsNewestFirst(
  notifications: NotificationItem[],
): NotificationItem[] {
  return [...notifications].sort(
    (left, right) =>
      new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
  );
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function getNotificationGroupKey(timestamp: string, now = new Date()): NotificationGroupKey {
  const date = new Date(timestamp);
  const today = startOfDay(now);
  const target = startOfDay(date);
  const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays <= 7) return "this_week";
  return "earlier";
}

export const NOTIFICATION_GROUP_LABELS: Record<NotificationGroupKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  this_week: "This Week",
  earlier: "Earlier",
};

export function groupNotificationsByTime(
  notifications: EnrichedNotification[],
  now = new Date(),
): Array<{ key: NotificationGroupKey; label: string; items: EnrichedNotification[] }> {
  const groups = new Map<NotificationGroupKey, EnrichedNotification[]>();

  for (const notification of notifications) {
    const key = getNotificationGroupKey(notification.timestamp, now);
    const existing = groups.get(key) ?? [];
    existing.push(notification);
    groups.set(key, existing);
  }

  const order: NotificationGroupKey[] = ["today", "yesterday", "this_week", "earlier"];

  return order
    .filter((key) => (groups.get(key)?.length ?? 0) > 0)
    .map((key) => ({
      key,
      label: NOTIFICATION_GROUP_LABELS[key],
      items: groups.get(key) ?? [],
    }));
}

export function formatRelativeNotificationTime(timestamp: string, now = new Date()): string {
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24 && getNotificationGroupKey(timestamp, now) === "today") {
    return `${diffHours}h ago`;
  }

  if (getNotificationGroupKey(timestamp, now) === "yesterday") {
    return "Yesterday";
  }

  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export const DISMISSED_VIRTUAL_NOTIFICATIONS_KEY = "buxme-dismissed-virtual-notifications";

export function readDismissedVirtualNotificationIds(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const raw = window.localStorage.getItem(DISMISSED_VIRTUAL_NOTIFICATIONS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function dismissVirtualNotification(id: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const next = readDismissedVirtualNotificationIds();
  next.add(id);
  window.localStorage.setItem(
    DISMISSED_VIRTUAL_NOTIFICATIONS_KEY,
    JSON.stringify(Array.from(next)),
  );
}
