import type { CategoryBudgetView } from "@/lib/budgets/categoryBudgets";
import { forecastCashUntilPayday } from "@/lib/finance/cashFlowForecast";
import { getSafeToSpend, getSafeToSpendWeekly } from "@/lib/finance/safeToSpend";
import type { FinanceData } from "@/lib/finance/types";
import { plannedSavingsUntilPayday } from "@/lib/finance/moneyLeftUntilPayday";

export type BudgetHubSummary = {
  safeToSpend: number;
  safeToSpendWeekly: number;
  safeUntilPayday: number;
  daysUntilPayday: number | null;
  dailySpendingAllowance: number;
  /** Sum of remaining category limits in their own periods — not cash. */
  totalRemainingBudgetAllowance: number;
  totalBudgetLimit: number;
  totalBudgetSpent: number;
  monthlyEquivalentTotal: number;
  approachingLimits: CategoryBudgetView[];
  overspentCategories: CategoryBudgetView[];
  projectedPeriodSurplusOrShortfall: number;
  plannedSavingsUntilPayday: number;
  explanation: string;
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildBudgetHubSummary(
  views: CategoryBudgetView[],
  data: FinanceData,
  referenceDate = new Date(),
): BudgetHubSummary {
  const payday = forecastCashUntilPayday(data, referenceDate);
  const safeToSpend = getSafeToSpend(data, referenceDate);
  const safeToSpendWeekly = getSafeToSpendWeekly(data, referenceDate);
  const daysUntilPayday = payday.daysUntilPayday;
  const dailySpendingAllowance =
    daysUntilPayday && daysUntilPayday > 0
      ? round(Math.max(payday.safeUntilPayday, 0) / daysUntilPayday)
      : round(Math.max(safeToSpendWeekly, 0) / 7);

  const totalRemainingBudgetAllowance = round(
    views.reduce((total, view) => total + Math.max(view.remaining, 0), 0),
  );
  const totalBudgetLimit = round(views.reduce((total, view) => total + view.limit, 0));
  const totalBudgetSpent = round(views.reduce((total, view) => total + view.spent, 0));
  const monthlyEquivalentTotal = round(
    views.reduce((total, view) => total + view.monthlyEquivalent, 0),
  );
  const projectedPeriodSurplusOrShortfall = round(
    views.reduce((total, view) => total + view.estimatedOverageOrSurplus, 0),
  );

  return {
    safeToSpend,
    safeToSpendWeekly,
    safeUntilPayday: payday.safeUntilPayday,
    daysUntilPayday,
    dailySpendingAllowance,
    totalRemainingBudgetAllowance,
    totalBudgetLimit,
    totalBudgetSpent,
    monthlyEquivalentTotal,
    approachingLimits: views.filter(
      (view) => !view.overspent && (view.progress >= 80 || (view.paceRatio ?? 0) >= 1.15),
    ),
    overspentCategories: views.filter((view) => view.overspent),
    projectedPeriodSurplusOrShortfall,
    plannedSavingsUntilPayday: plannedSavingsUntilPayday(data, referenceDate),
    explanation:
      "Safe to Spend and cash until payday are capped by eligible available cash after bills and planned savings. Remaining budget allowance is the unused portion of your category limits — it is not extra cash you can spend.",
  };
}
