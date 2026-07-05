import { buildDashboardFromSnapshot, computeFinancialSnapshot } from "@/lib/finance/financialEngine";
import type { DashboardData, FinanceData } from "@/lib/finance/types";

/** @deprecated Prefer computeFinancialEngine().dashboard */
export function computeDashboard(
  data: FinanceData,
  referenceDate = new Date(),
): DashboardData {
  const snapshot = computeFinancialSnapshot(data, referenceDate);
  return buildDashboardFromSnapshot(snapshot, referenceDate);
}
