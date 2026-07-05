import {
  calculateFinancialHealth,
  calculateNetWorthBreakdown,
  calculateSavingsProgress,
} from "@/lib/calculations";
import { calculateMonthlyIncome } from "@/lib/calculations/cashFlow";
import { projectAllHorizons } from "@/lib/allocation/forecastEngine";
import { getLedgerAuditTrail, summarizeLedger } from "@/lib/allocation/reportingEngine";
import { getBillsDashboardSummary } from "@/lib/finance/bills";
import { getDebtsDashboardSummary } from "@/lib/finance/debts";
import { formatGoalDate, getNextGoal } from "@/lib/finance/goals";
import { getNextPaycheck } from "@/lib/finance/income";
import { calculateMoneyFlow, type MoneyFlowResult } from "@/lib/finance/moneyFlow";
import {
  computeCategoryBreakdown,
  computeMonthlyTrends,
  type CategoryBreakdownItem,
  type MonthlyTrendPoint,
} from "@/lib/reports/reportMetrics";
import { getSafeToSpend, getSafeToSpendWeekly } from "@/lib/finance/safeToSpend";
import { generateWeeklyPlan } from "@/lib/intelligence";
import { generateRoadmap, toNextMilestoneSummary } from "@/lib/roadmap";
import { generateTodayActivity, normalizeRecurringFinanceData } from "@/lib/recurring";
import type {
  BillsDashboardSummary,
  DashboardData,
  DebtsDashboardSummary,
  FinanceData,
  FinancialHealthScoreData,
  KPIMetric,
  MoneyFlowData,
  NextGoalSummary,
  NextMilestoneSummary,
  SmartInsight,
  TodayActivitySummary,
  WeeklyPlanRecommendation,
} from "@/lib/finance/types";
import type { AllocationForecast, LedgerReport } from "@/lib/allocation/types";
import { buildCalendarMonth, type CalendarMonthSummary } from "@/lib/finance/calendarEvents";
import { formatCurrency } from "@/lib/finance/format";
import { getPrimaryHealthReasons } from "@/lib/calculations";

export type FinancialSnapshot = {
  normalized: FinanceData;
  moneyFlow: MoneyFlowResult;
  safeToSpend: number;
  safeToSpendWeekly: number;
  netWorthBreakdown: ReturnType<typeof calculateNetWorthBreakdown>;
  savingsProgress: ReturnType<typeof calculateSavingsProgress>;
  financialHealth: ReturnType<typeof calculateFinancialHealth>;
  billsSummary: BillsDashboardSummary;
  debtsSummary: DebtsDashboardSummary;
  monthlyTrends: MonthlyTrendPoint[];
  categoryBreakdown: CategoryBreakdownItem[];
  forecasts: AllocationForecast[];
  ledgerReport: LedgerReport;
  ledgerAuditTrail: ReturnType<typeof getLedgerAuditTrail>;
  calendarMonth: (year: number, month: number) => CalendarMonthSummary;
};

function buildSmartInsights(
  data: FinanceData,
  savings: ReturnType<typeof calculateSavingsProgress>,
  health: ReturnType<typeof calculateFinancialHealth>,
): SmartInsight[] {
  const primaryReasons = getPrimaryHealthReasons(health.reasons);
  const diningBill = (data.bills ?? []).find((bill) =>
    bill.name.toLowerCase().includes("dining"),
  );
  const insuranceBill = (data.bills ?? []).find((bill) =>
    (bill.category ?? "").toLowerCase().includes("insurance"),
  );
  const diningShare =
    diningBill && savings.monthlyIncome > 0
      ? Math.round((diningBill.amount / savings.monthlyIncome) * 100)
      : 0;

  const insights: SmartInsight[] = [
    {
      tone: "blue",
      before: "You're on pace to save ",
      highlight: formatCurrency(savings.annualSavingsProjection),
      after: " this year if current habits continue.",
    },
  ];

  if (diningBill && diningShare <= 10) {
    insights.push({
      tone: "emerald",
      before: "",
      after: `Dining spend is ${diningShare}% of income — great progress.`,
    });
  } else {
    insights.push({
      tone: primaryReasons[0]?.impact === "positive" ? "emerald" : "amber",
      before: "",
      after:
        primaryReasons[0]?.message ??
        health.reasons[0]?.message ??
        "Add income and bills to unlock personalized insights.",
    });
  }

  if (insuranceBill) {
    insights.push({
      tone: "amber",
      before: "",
      after: `Your ${insuranceBill.name.toLowerCase()} bill is ${formatCurrency(insuranceBill.amount)}/mo. Review quotes to optimize.`,
    });
  } else {
    insights.push({
      tone: primaryReasons[1]?.impact === "positive" ? "emerald" : "amber",
      before: "",
      after:
        primaryReasons[1]?.message ??
        health.reasons[1]?.message ??
        "Track spending to improve your financial health score.",
    });
  }

  return insights;
}

function toMoneyFlowData(moneyFlow: MoneyFlowResult): MoneyFlowData {
  const flowMax = Math.max(
    moneyFlow.income,
    moneyFlow.bills + moneyFlow.debts,
    1,
  );

  return {
    income: moneyFlow.income,
    bills: moneyFlow.bills,
    debts: moneyFlow.debts,
    goals: moneyFlow.goals,
    investments: moneyFlow.investments,
    safeToSpend: moneyFlow.safeToSpend,
    stages: moneyFlow.stages,
    breakdown: moneyFlow.breakdown,
    spending: {
      amount: moneyFlow.bills + moneyFlow.debts,
      barWidthPercent: Math.round(
        ((moneyFlow.bills + moneyFlow.debts) / flowMax) * 100 * 0.85,
      ),
    },
    netFlow: moneyFlow.safeToSpend,
  };
}

function toHealthScoreData(
  health: ReturnType<typeof calculateFinancialHealth>,
): FinancialHealthScoreData {
  return {
    score: health.score,
    strokeDasharray: health.strokeDasharray,
    strokeDashoffset: health.strokeDashoffset,
    reasons: health.reasons.map((reason) => reason.message),
    metrics: [
      {
        label: "Savings rate",
        value: health.savingsRateLabel,
        tone: health.savingsRateTone,
      },
      {
        label: "Debt load",
        value: health.debtLoadLabel,
        tone: health.debtLoadTone,
      },
      {
        label: "Debt utilization",
        value: health.debtUtilizationLabel,
        tone: health.debtUtilizationTone,
      },
      {
        label: "Emergency fund",
        value: health.emergencyFundLabel,
        tone: health.emergencyFundTone,
      },
    ],
  };
}

/**
 * Single financial source of truth. All pages derive metrics from this snapshot.
 */
export function computeFinancialSnapshot(
  data: FinanceData,
  referenceDate = new Date(),
): FinancialSnapshot {
  const normalized = normalizeRecurringFinanceData(data, referenceDate);
  const moneyFlow = calculateMoneyFlow(normalized);
  const safeToSpend = moneyFlow.safeToSpend;
  const safeToSpendWeekly = getSafeToSpendWeekly(normalized, referenceDate);
  const netWorthBreakdown = calculateNetWorthBreakdown(normalized);
  const savingsProgress = calculateSavingsProgress(normalized);
  const financialHealth = calculateFinancialHealth(normalized);

  const billsBase = getBillsDashboardSummary(normalized, referenceDate);
  const billsSummary: BillsDashboardSummary = {
    ...billsBase,
    monthlyCashRemaining:
      calculateMonthlyIncome(normalized, referenceDate) - moneyFlow.bills,
    safeToSpendAfterUpcomingBills: safeToSpend,
  };

  const plan = normalized.incomePlan;
  const forecasts = plan ? projectAllHorizons(normalized, plan, referenceDate) : [];
  const ledgerReport = summarizeLedger(normalized);
  const ledgerAuditTrail = getLedgerAuditTrail(normalized);

  return {
    normalized,
    moneyFlow,
    safeToSpend,
    safeToSpendWeekly,
    netWorthBreakdown,
    savingsProgress,
    financialHealth,
    billsSummary,
    debtsSummary: getDebtsDashboardSummary(normalized),
    monthlyTrends: computeMonthlyTrends(normalized),
    categoryBreakdown: computeCategoryBreakdown(normalized),
    forecasts,
    ledgerReport,
    ledgerAuditTrail,
    calendarMonth: (year, month) =>
      buildCalendarMonth(normalized, year, month, referenceDate),
  };
}

export function buildDashboardFromSnapshot(
  snapshot: FinancialSnapshot,
  referenceDate = new Date(),
): DashboardData {
  const { normalized, moneyFlow, netWorthBreakdown, financialHealth } = snapshot;
  const nextGoalProgress = getNextGoal(normalized);
  const roadmap = generateRoadmap(normalized);
  const moneyFlowData = toMoneyFlowData(moneyFlow);

  const kpiMetrics: KPIMetric[] = [
    {
      label: "Net Worth",
      value: netWorthBreakdown.netWorth.value,
      monthlyChange: netWorthBreakdown.netWorth.monthlyChange,
    },
    {
      label: "Cash",
      value: netWorthBreakdown.cash.value,
      monthlyChange: netWorthBreakdown.cash.monthlyChange,
    },
    {
      label: "Debt",
      value: netWorthBreakdown.debt.value,
      monthlyChange: netWorthBreakdown.debt.monthlyChange,
    },
    {
      label: "Investments",
      value: netWorthBreakdown.investments.value,
      monthlyChange: netWorthBreakdown.investments.monthlyChange,
    },
    {
      label: "Safe To Spend",
      value: snapshot.safeToSpend,
      monthlyChange: 0,
    },
  ];

  const nextGoal: NextGoalSummary | null = nextGoalProgress
    ? {
        id: nextGoalProgress.id,
        name: nextGoalProgress.name,
        icon: nextGoalProgress.icon,
        percentComplete: nextGoalProgress.percentComplete,
        estimatedCompletionDate: formatGoalDate(
          nextGoalProgress.estimatedCompletionDate,
        ),
        remaining: nextGoalProgress.remaining,
      }
    : null;

  const nextMilestone = toNextMilestoneSummary(roadmap.nextMilestone);

  const weeklyPlan: WeeklyPlanRecommendation[] = generateWeeklyPlan(normalized);
  const todayActivity: TodayActivitySummary = generateTodayActivity(normalized);

  return {
    kpiMetrics,
    moneyFlow: moneyFlowData,
    financialHealthScore: toHealthScoreData(financialHealth),
    smartInsights: buildSmartInsights(
      normalized,
      snapshot.savingsProgress,
      financialHealth,
    ),
    nextGoal,
    nextMilestone,
    nextPaycheck: getNextPaycheck(normalized, referenceDate),
    billsSummary: snapshot.billsSummary,
    debtsSummary: snapshot.debtsSummary,
    weeklyPlan,
    todayActivity,
  };
}

/** Convenience: snapshot + dashboard in one call. */
export function computeFinancialEngine(
  data: FinanceData,
  referenceDate = new Date(),
): { snapshot: FinancialSnapshot; dashboard: DashboardData } {
  const snapshot = computeFinancialSnapshot(data, referenceDate);
  return {
    snapshot,
    dashboard: buildDashboardFromSnapshot(snapshot, referenceDate),
  };
}
