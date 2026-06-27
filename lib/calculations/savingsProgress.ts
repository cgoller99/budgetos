import type { FinanceData } from "@/lib/finance/types";
import { calculateMonthlyIncome, calculateNetCashFlow } from "./cashFlow";
import type { SavingsProgressResult } from "./types";

export function calculateMonthlySavings(data: FinanceData): number {
  return Math.max(calculateNetCashFlow(data), 0);
}

export function calculateSavingsRate(data: FinanceData): number {
  const income = calculateMonthlyIncome(data);

  if (income <= 0) {
    return 0;
  }

  return calculateMonthlySavings(data) / income;
}

export function calculateAnnualSavingsProjection(data: FinanceData): number {
  return calculateMonthlySavings(data) * 12;
}

export function calculateSavingsProgress(data: FinanceData): SavingsProgressResult {
  const monthlyIncome = calculateMonthlyIncome(data);
  const monthlySavings = calculateMonthlySavings(data);

  return {
    savingsRate: calculateSavingsRate(data),
    monthlySavings,
    monthlyIncome,
    annualSavingsProjection: calculateAnnualSavingsProjection(data),
    goalProgress: (data.savingsGoals ?? []).map((goal) => ({
      id: goal.id,
      name: goal.name,
      current: goal.current,
      target: goal.target,
      percent: goal.target > 0 ? Math.round((goal.current / goal.target) * 100) : 0,
    })),
  };
}

export function formatSavingsRateLabel(rate: number): string {
  if (rate >= 0.2) {
    return "Strong";
  }

  if (rate >= 0.1) {
    return "Moderate";
  }

  return "Needs attention";
}
