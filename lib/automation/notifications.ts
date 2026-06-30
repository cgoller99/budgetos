import type { AutomationSuggestion } from "@/lib/automation/types";
import type { NotificationItem } from "@/lib/events/types";

export function automationSuggestionToNotification(
  suggestion: AutomationSuggestion,
): NotificationItem {
  return {
    id: suggestion.id,
    title: suggestion.title,
    subtitle: suggestion.description,
    icon: suggestion.icon,
    tone: suggestion.tone,
    timestamp: suggestion.timestamp,
    read: false,
    automationSuggestionId: suggestion.id,
    detailHref: suggestion.detailHref,
    actions: {
      primary: suggestion.primaryAction,
      secondary: suggestion.secondaryAction,
    },
  };
}

export function mergeAutomationNotifications(
  notifications: NotificationItem[],
  automationSuggestions: AutomationSuggestion[],
): NotificationItem[] {
  const automationItems = automationSuggestions.map(automationSuggestionToNotification);
  const automationIds = new Set(automationItems.map((item) => item.id));

  const filtered = notifications.filter(
    (item) => !item.automationSuggestionId || !automationIds.has(item.id),
  );

  return [...automationItems, ...filtered];
}
