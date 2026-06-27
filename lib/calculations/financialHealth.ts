import type { FinanceData } from "@/lib/finance/types";
import {
  calculateDebtUtilization,
  formatDebtUtilizationLabel,
} from "@/lib/finance/debts";
import { calculateCash, calculateDebt, calculateInvestments } from "./netWorth";
import {
  calculateMonthlyIncome,
  calculateMonthlySpending,
} from "./cashFlow";
import {
  calculateMonthlySavings,
  calculateSavingsRate,
  formatSavingsRateLabel,
} from "./savingsProgress";
import type { FinancialHealthReason, FinancialHealthResult } from "./types";

const HEALTH_CIRCUMFERENCE = 264;

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreSavingsRate(rate: number): number {
  if (rate >= 0.2) return 20;
  if (rate >= 0.15) return 16;
  if (rate >= 0.1) return 12;
  if (rate >= 0.05) return 8;
  return 4;
}

function scoreEmergencyFund(monthsOfCoverage: number): number {
  if (monthsOfCoverage >= 6) return 20;
  if (monthsOfCoverage >= 3) return 15;
  if (monthsOfCoverage >= 1) return 10;
  return 5;
}

function scoreDebtToIncome(ratio: number): number {
  if (ratio <= 0.1) return 20;
  if (ratio <= 0.2) return 15;
  if (ratio <= 0.35) return 10;
  return 5;
}

function scoreDebtUtilization(ratio: number): number {
  if (ratio <= 0.2) return 20;
  if (ratio <= 0.35) return 15;
  if (ratio <= 0.5) return 10;
  return 5;
}

function scoreInvestmentProgress(progress: number): number {
  if (progress >= 1) return 20;
  if (progress >= 0.75) return 16;
  if (progress >= 0.5) return 12;
  if (progress >= 0.25) return 8;
  return 4;
}

function scoreBillPaymentStatus(autopayRate: number): number {
  if (autopayRate >= 0.9) return 20;
  if (autopayRate >= 0.75) return 15;
  if (autopayRate >= 0.5) return 10;
  return 5;
}

function formatDebtLoadLabel(ratio: number): string {
  if (ratio <= 0.15) return "Low";
  if (ratio <= 0.3) return "Moderate";
  return "High";
}

function formatEmergencyFundLabel(monthsOfCoverage: number): string {
  if (monthsOfCoverage >= 3) return "On track";
  if (monthsOfCoverage >= 1) return "Building";
  return "Low";
}

function getTone(isPositive: boolean): "emerald" | "amber" {
  return isPositive ? "emerald" : "amber";
}

export function calculateDebtToIncomeRatio(data: FinanceData): number {
  const income = calculateMonthlyIncome(data);

  if (income <= 0) {
    return 0;
  }

  const minimumDebtPayments = (data.debts ?? []).reduce(
    (total, debt) => total + debt.minimumPayment,
    0,
  );

  return minimumDebtPayments / income;
}

export function calculateDebtUtilizationRatio(data: FinanceData): number {
  return calculateDebtUtilization(data);
}

export function calculateEmergencyFundMonths(data: FinanceData): number {
  const spending = calculateMonthlySpending(data);

  if (spending <= 0) {
    return 0;
  }

  return calculateCash(data).value / spending;
}

export function calculateInvestmentProgress(data: FinanceData): number {
  const investmentTotal = calculateInvestments(data).value;
  const goalTargets = (data.savingsGoals ?? []).reduce(
    (total, goal) => total + goal.target,
    0,
  );

  if (goalTargets <= 0) {
    return investmentTotal > 0 ? 1 : 0;
  }

  return investmentTotal / goalTargets;
}

export function calculateBillAutopayRate(data: FinanceData): number {
  const bills = data.bills ?? [];

  if (bills.length === 0) {
    return 0.5;
  }

  const autopayCount = bills.filter((bill) => bill.autopay).length;
  return autopayCount / bills.length;
}

export function calculateFinancialHealth(data: FinanceData): FinancialHealthResult {
  const savingsRate = calculateSavingsRate(data);
  const emergencyFundMonths = calculateEmergencyFundMonths(data);
  const debtToIncome = calculateDebtToIncomeRatio(data);
  const debtUtilization = calculateDebtUtilization(data);
  const investmentProgress = calculateInvestmentProgress(data);
  const billAutopayRate = calculateBillAutopayRate(data);

  const savingsRateScore = scoreSavingsRate(savingsRate);
  const emergencyFundScore = scoreEmergencyFund(emergencyFundMonths);
  const debtToIncomeScore = scoreDebtToIncome(debtToIncome);
  const debtUtilizationScore = scoreDebtUtilization(debtUtilization);
  const investmentProgressScore = scoreInvestmentProgress(investmentProgress);
  const billPaymentScore = scoreBillPaymentStatus(billAutopayRate);

  const score = clampScore(
    savingsRateScore +
      emergencyFundScore +
      debtToIncomeScore +
      debtUtilizationScore +
      investmentProgressScore +
      billPaymentScore,
  );

  const reasons: FinancialHealthReason[] = [
    {
      factor: "Savings Rate",
      impact: savingsRateScore >= 12 ? "positive" : savingsRateScore >= 8 ? "neutral" : "negative",
      message:
        savingsRateScore >= 12
          ? `You are saving ${Math.round(savingsRate * 100)}% of income each month.`
          : `Your savings rate is ${Math.round(savingsRate * 100)}%, below the recommended 10–20%.`,
    },
    {
      factor: "Emergency Fund",
      impact:
        emergencyFundScore >= 15 ? "positive" : emergencyFundScore >= 10 ? "neutral" : "negative",
      message:
        emergencyFundScore >= 15
          ? `Cash covers ${emergencyFundMonths.toFixed(1)} months of expenses.`
          : `Your emergency fund covers ${emergencyFundMonths.toFixed(1)} months of expenses.`,
    },
    {
      factor: "Debt-to-Income",
      impact: debtToIncomeScore >= 15 ? "positive" : debtToIncomeScore >= 10 ? "neutral" : "negative",
      message:
        debtToIncomeScore >= 15
          ? `Debt payments are ${Math.round(debtToIncome * 100)}% of income — manageable.`
          : `Debt payments consume ${Math.round(debtToIncome * 100)}% of monthly income.`,
    },
    {
      factor: "Debt Utilization",
      impact:
        debtUtilizationScore >= 15
          ? "positive"
          : debtUtilizationScore >= 10
            ? "neutral"
            : "negative",
      message:
        debtUtilizationScore >= 15
          ? `Debt is ${Math.round(debtUtilization * 100)}% of debt plus liquid assets — healthy leverage.`
          : `Debt makes up ${Math.round(debtUtilization * 100)}% of debt plus liquid assets.`,
    },
    {
      factor: "Investment Progress",
      impact:
        investmentProgressScore >= 12 ? "positive" : investmentProgressScore >= 8 ? "neutral" : "negative",
      message:
        investmentProgressScore >= 12
          ? "Investment balances are ahead of your savings goal targets."
          : "Investment balances have room to grow relative to your goals.",
    },
    {
      factor: "Bill Payment Status",
      impact: billPaymentScore >= 15 ? "positive" : billPaymentScore >= 10 ? "neutral" : "negative",
      message:
        billPaymentScore >= 15
          ? `${Math.round(billAutopayRate * 100)}% of bills are on autopay.`
          : `${Math.round((1 - billAutopayRate) * 100)}% of bills still require manual payment.`,
    },
  ];

  const savingsRateLabel = formatSavingsRateLabel(savingsRate);
  const debtLoadLabel = formatDebtLoadLabel(debtToIncome);
  const debtUtilizationLabel = formatDebtUtilizationLabel(debtUtilization);
  const emergencyFundLabel = formatEmergencyFundLabel(emergencyFundMonths);

  return {
    score,
    reasons,
    strokeDasharray: HEALTH_CIRCUMFERENCE,
    strokeDashoffset: HEALTH_CIRCUMFERENCE * (1 - score / 100),
    savingsRateLabel,
    debtLoadLabel,
    debtUtilizationLabel,
    emergencyFundLabel,
    savingsRateTone: getTone(savingsRateScore >= 12),
    debtLoadTone: getTone(debtToIncomeScore >= 15),
    debtUtilizationTone: getTone(debtUtilizationScore >= 15),
    emergencyFundTone: getTone(emergencyFundScore >= 15),
  };
}

export function getPrimaryHealthReasons(
  reasons: FinancialHealthReason[],
): FinancialHealthReason[] {
  return [...reasons]
    .sort((left, right) => {
      const weight = { negative: 0, neutral: 1, positive: 2 };
      return weight[left.impact] - weight[right.impact];
    })
    .slice(0, 3);
}
