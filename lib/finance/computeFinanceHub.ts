import { computeDashboard } from "@/lib/finance/computeDashboard";
import { coerceFinanceData, emptyFinanceData } from "@/lib/finance/emptyFinanceData";
import type { DashboardData, FinanceData } from "@/lib/finance/types";
import {
  getNotifications,
  getRecentActivity,
  getUnreadNotificationCount,
} from "@/lib/events";
import type { ActivityItem, NotificationItem } from "@/lib/events/types";

export type FinanceHubData = {
  dashboard: DashboardData;
  recentActivity: ActivityItem[];
  notifications: NotificationItem[];
  unreadNotificationCount: number;
};

export function computeFinanceHub(data: FinanceData): FinanceHubData {
  const safeData = coerceFinanceData(data);

  try {
    return {
      dashboard: computeDashboard(safeData),
      recentActivity: getRecentActivity(safeData),
      notifications: getNotifications(safeData),
      unreadNotificationCount: getUnreadNotificationCount(safeData),
    };
  } catch {
    return {
      dashboard: computeDashboard(emptyFinanceData),
      recentActivity: [],
      notifications: [],
      unreadNotificationCount: 0,
    };
  }
}
