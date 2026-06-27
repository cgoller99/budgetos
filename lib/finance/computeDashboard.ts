import {
  calculateFinancialHealth,
  calculateNetWorthBreakdown,
  calculateSavingsProgress,
  getPrimaryHealthReasons,
} from "@/lib/calculations";
import { formatCurrency } from "@/lib/finance/format";
import { getBillsDashboardSummary } from "@/lib/finance/bills";
import { getDebtsDashboardSummary } from "@/lib/finance/debts";
import { formatGoalDate, getNextGoal } from "@/lib/finance/goals";
import { calculateMoneyFlow } from "@/lib/finance/moneyFlow";
import { generateWeeklyPlan } from "@/lib/intelligence";
import {
  generateRoadmap,
  toNextMilestoneSummary,
} from "@/lib/roadmap";
import {
  generateTodayActivity,
  normalizeRecurringFinanceData,
} from "@/lib/recurring";
import type { DashboardData, FinanceData, SmartInsight } from "@/lib/finance/types";

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
      after: primaryReasons[0]?.message ?? health.reasons[0]?.message ?? "Add income and bills to unlock personalized insights.",
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
      after: primaryReasons[1]?.message ?? health.reasons[1]?.message ?? "Track spending to improve your financial health score.",
    });
  }

  return insights;
}

export function computeDashboard(data: FinanceData): DashboardData {
  const normalized = normalizeRecurringFinanceData(data);
  const breakdown = calculateNetWorthBreakdown(normalized);
  const savings = calculateSavingsProgress(normalized);
  const health = calculateFinancialHealth(normalized);
  const nextGoalProgress = getNextGoal(normalized);
  const roadmap = generateRoadmap(normalized);
  const moneyFlow = calculateMoneyFlow(normalized);
  const flowMax = Math.max(
    moneyFlow.income,
    moneyFlow.bills + moneyFlow.debts,
    1,
  );

  return {
    kpiMetrics: [
      {
        label: "Net Worth",
        value: breakdown.netWorth.value,
        monthlyChange: breakdown.netWorth.monthlyChange,
      },
      {
        label: "Cash",
        value: breakdown.cash.value,
        monthlyChange: breakdown.cash.monthlyChange,
      },
      {
        label: "Debt",
        value: breakdown.debt.value,
        monthlyChange: breakdown.debt.monthlyChange,
      },
      {
        label: "Investments",
        value: breakdown.investments.value,
        monthlyChange: breakdown.investments.monthlyChange,
      },
    ],
    moneyFlow: {
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
    },
    financialHealthScore: {
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
    },
    smartInsights: buildSmartInsights(normalized, savings, health),
    nextGoal: nextGoalProgress
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
      : null,
    nextMilestone: toNextMilestoneSummary(roadmap.nextMilestone),
    billsSummary: getBillsDashboardSummary(normalized),
    debtsSummary: getDebtsDashboardSummary(normalized),
    weeklyPlan: generateWeeklyPlan(normalized),
    todayActivity: generateTodayActivity(normalized),
  };
}
