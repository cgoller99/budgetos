import { computeFinancialEngine } from "@/lib/finance/financialEngine";
import { coerceFinanceData, emptyFinanceData } from "@/lib/finance/emptyFinanceData";
import type { DashboardData, FinanceData } from "@/lib/finance/types";
import type { FinancialSnapshot } from "@/lib/finance/financialEngine";
import {
  getNotifications,
  getRecentActivity,
  getUnreadNotificationCount,
} from "@/lib/events";
import type { ActivityItem, NotificationItem } from "@/lib/events/types";

export type FinanceHubData = {
  snapshot: FinancialSnapshot;
  dashboard: DashboardData;
  recentActivity: ActivityItem[];
  notifications: NotificationItem[];
  unreadNotificationCount: number;
};

export function computeFinanceHub(data: FinanceData): FinanceHubData {
  const safeData = coerceFinanceData(data);

  try {
    const { snapshot, dashboard } = computeFinancialEngine(safeData);

    return {
      snapshot,
      dashboard,
      recentActivity: getRecentActivity(safeData),
      notifications: getNotifications(safeData),
      unreadNotificationCount: getUnreadNotificationCount(safeData),
    };
  } catch {
    const { snapshot, dashboard } = computeFinancialEngine(emptyFinanceData);

    return {
      snapshot,
      dashboard,
      recentActivity: [],
      notifications: [],
      unreadNotificationCount: 0,
    };
  }
}
