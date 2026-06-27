import {
  calculateBillsDueThisWeekTotal,
  calculateDaysUntilNextPaycheck,
  calculateNetWorthMonthlyChange,
  calculateSafeToSpendBeforePaycheck,
  formatCurrency,
  formatPaycheckLabel,
  getEmergencyFundStatus,
  suggestExtraDebtPayment,
  suggestGoalWeeklyBoost,
} from "@/lib/intelligence/calculations";
import type { PlanCandidate } from "@/lib/intelligence/types";
import { getBillsDueThisWeek } from "@/lib/finance/bills";
import { calculateMoneyFlow } from "@/lib/finance/moneyFlow";
import type { FinanceData } from "@/lib/finance/types";
import type { WeeklyPlanRecommendation } from "@/lib/intelligence/types";

function buildSafeToSpendRecommendation(
  data: FinanceData,
  referenceDate: Date,
): PlanCandidate | null {
  const amount = calculateSafeToSpendBeforePaycheck(data, referenceDate);
  const moneyFlow = calculateMoneyFlow(data);
  const paycheckLabel = formatPaycheckLabel(data);

  if (moneyFlow.income <= 0) {
    return null;
  }

  if (amount <= 0) {
    return {
      id: "safe-to-spend-critical",
      message: `Your safe-to-spend balance is depleted before your ${paycheckLabel}. Review bills and spending.`,
      priority: "critical",
      score: 92,
    };
  }

  const weeklyBills = calculateBillsDueThisWeekTotal(data, referenceDate);
  const priority =
    amount < weeklyBills ? "attention" : amount < weeklyBills * 1.5 ? "attention" : "positive";

  return {
    id: "safe-to-spend",
    message: `You have ${formatCurrency(amount)} safe to spend before your ${paycheckLabel}.`,
    priority,
    score: priority === "positive" ? 68 : 78,
  };
}

function buildBillsThisWeekRecommendation(
  data: FinanceData,
  referenceDate: Date,
): PlanCandidate | null {
  const dueThisWeek = getBillsDueThisWeek(data, referenceDate);

  if (dueThisWeek.length === 0) {
    return null;
  }

  const total = dueThisWeek.reduce((sum, bill) => sum + bill.amount, 0);
  const hasOverdue = dueThisWeek.some((bill) => bill.status === "overdue");

  return {
    id: "bills-this-week",
    message: `Your bills this week total ${formatCurrency(total)}.`,
    priority: hasOverdue ? "critical" : "attention",
    score: hasOverdue ? 98 : 82,
  };
}

function buildEmergencyFundRecommendation(
  data: FinanceData,
): PlanCandidate | null {
  const status = getEmergencyFundStatus(data);

  if (!status.belowTarget) {
    return null;
  }

  return {
    id: "emergency-fund",
    message: "Your emergency fund is below your 6-month target.",
    priority: status.severity === "critical" ? "critical" : "attention",
    score: status.severity === "critical" ? 96 : 88,
  };
}

function buildGoalBoostRecommendation(
  data: FinanceData,
): PlanCandidate | null {
  const suggestion = suggestGoalWeeklyBoost(data);

  if (!suggestion) {
    return null;
  }

  return {
    id: "goal-boost",
    message: `Saving ${formatCurrency(suggestion.weeklyAmount)} more this week keeps your ${suggestion.goalName} Goal on schedule.`,
    priority: "attention",
    score: 74,
  };
}

function buildDebtPaydownRecommendation(
  data: FinanceData,
): PlanCandidate | null {
  const suggestion = suggestExtraDebtPayment(data);

  if (!suggestion) {
    return null;
  }

  const monthLabel =
    suggestion.monthsSaved === 1 ? "1 month" : `${suggestion.monthsSaved} months`;

  return {
    id: "debt-extra-payment",
    message: `Paying an extra ${formatCurrency(suggestion.extraPayment)} toward your ${suggestion.debt.name.toLowerCase()} saves approximately ${monthLabel}.`,
    priority: "attention",
    score: 72,
  };
}

function buildNetWorthRecommendation(data: FinanceData): PlanCandidate | null {
  const change = calculateNetWorthMonthlyChange(data);

  if (change <= 0) {
    return null;
  }

  return {
    id: "net-worth-up",
    message: `Great job! Your net worth increased ${formatCurrency(Math.abs(change))} this month.`,
    priority: "positive",
    score: 45,
  };
}

function buildOverdueBillsRecommendation(
  data: FinanceData,
  referenceDate: Date,
): PlanCandidate | null {
  const overdue = getBillsDueThisWeek(data, referenceDate).filter(
    (bill) => bill.status === "overdue",
  );

  if (overdue.length === 0) {
    return null;
  }

  return {
    id: "overdue-bills",
    message: `You have ${overdue.length} overdue bill${overdue.length === 1 ? "" : "s"}. Pay them first to avoid fees.`,
    priority: "critical",
    score: 99,
  };
}

function collectCandidates(
  data: FinanceData,
  referenceDate: Date,
): PlanCandidate[] {
  const candidates = [
    buildOverdueBillsRecommendation(data, referenceDate),
    buildEmergencyFundRecommendation(data),
    buildBillsThisWeekRecommendation(data, referenceDate),
    buildSafeToSpendRecommendation(data, referenceDate),
    buildGoalBoostRecommendation(data),
    buildDebtPaydownRecommendation(data),
    buildNetWorthRecommendation(data),
  ].filter((candidate): candidate is PlanCandidate => candidate !== null);

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.id)) {
      return false;
    }

    seen.add(candidate.id);
    return true;
  });
}

export function generateWeeklyPlan(
  data: FinanceData,
  referenceDate = new Date(),
): WeeklyPlanRecommendation[] {
  const candidates = collectCandidates(data, referenceDate);

  if (candidates.length === 0) {
    return [
      {
        id: "fallback",
        message: "Add income and bills to unlock personalized weekly recommendations.",
        priority: "attention",
      },
    ];
  }

  const sorted = [...candidates].sort((left, right) => right.score - left.score);

  return sorted.slice(0, 3).map(({ id, message, priority }) => ({
    id,
    message,
    priority,
  }));
}

export function getWeeklyPlanSignature(
  recommendations: WeeklyPlanRecommendation[],
): string {
  return recommendations.map((item) => `${item.id}:${item.message}`).join("|");
}
