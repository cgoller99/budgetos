import { calculateMonthlyIncome, calculateMonthlySpending } from "@/lib/calculations/cashFlow";
import { calculateAvailableCash, hasPlaidLinkedCashAccounts } from "@/lib/calculations/availableCash";
import { getTotalMinimumPayments } from "@/lib/finance/debts";
import type { FinanceData } from "@/lib/finance/types";

export type MoneyFlowStageId =
  | "income"
  | "bills"
  | "debts"
  | "goals"
  | "investments"
  | "safeToSpend";

export type MoneyFlowStage = {
  id: MoneyFlowStageId;
  label: string;
  icon: string;
  color: string;
  glowColor: string;
  amount: number;
  percentOfIncome: number;
  isOutflow: boolean;
};

export type MoneyFlowBreakdownLine = {
  id: MoneyFlowStageId;
  label: string;
  amount: number;
  percentOfIncome: number;
  isOutflow: boolean;
};

export type MoneyFlowResult = {
  income: number;
  bills: number;
  debts: number;
  goals: number;
  investments: number;
  safeToSpend: number;
  stages: MoneyFlowStage[];
  breakdown: MoneyFlowBreakdownLine[];
};

const GOAL_ALLOCATION_MONTHS = 12;

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function calculateRawGoalContributions(data: FinanceData): number {
  const activeGoals = (data.savingsGoals ?? []).filter(
    (goal) => goal.current < goal.target,
  );

  return activeGoals.reduce((total, goal) => {
    const remaining = goal.target - goal.current;
    const monthlyNeed = Math.ceil(remaining / GOAL_ALLOCATION_MONTHS);
    return total + monthlyNeed;
  }, 0);
}

function calculateRawInvestmentContributions(data: FinanceData): number {
  return sum(
    (data.investments ?? []).map((investment) => investment.monthlyContribution),
  );
}

function percentOfIncome(amount: number, income: number): number {
  if (income <= 0) {
    return 0;
  }

  return Math.round((amount / income) * 100);
}

function buildStages(
  income: number,
  bills: number,
  debts: number,
  goals: number,
  investments: number,
  safeToSpend: number,
): MoneyFlowStage[] {
  return [
    {
      id: "income",
      label: "Income",
      icon: "💵",
      color: "var(--accent)",
      glowColor: "rgba(0,119,237,0.25)",
      amount: income,
      percentOfIncome: income > 0 ? 100 : 0,
      isOutflow: false,
    },
    {
      id: "bills",
      label: "Bills",
      icon: "📋",
      color: "var(--accent-light)",
      glowColor: "rgba(77,163,255,0.22)",
      amount: bills,
      percentOfIncome: percentOfIncome(bills, income),
      isOutflow: true,
    },
    {
      id: "debts",
      label: "Debt Payments",
      icon: "💳",
      color: "#3b82f6",
      glowColor: "rgba(59,130,246,0.22)",
      amount: debts,
      percentOfIncome: percentOfIncome(debts, income),
      isOutflow: true,
    },
    {
      id: "goals",
      label: "Goals",
      icon: "🎯",
      color: "#2563eb",
      glowColor: "rgba(37,99,235,0.22)",
      amount: goals,
      percentOfIncome: percentOfIncome(goals, income),
      isOutflow: true,
    },
    {
      id: "investments",
      label: "Investments",
      icon: "📈",
      color: "#1d4ed8",
      glowColor: "rgba(29,78,216,0.22)",
      amount: investments,
      percentOfIncome: percentOfIncome(investments, income),
      isOutflow: true,
    },
    {
      id: "safeToSpend",
      label: "Safe To Spend",
      icon: "✨",
      color: "#60a5fa",
      glowColor: "rgba(96,165,250,0.25)",
      amount: safeToSpend,
      percentOfIncome: percentOfIncome(safeToSpend, income),
      isOutflow: false,
    },
  ];
}

function buildBreakdown(
  income: number,
  bills: number,
  debts: number,
  goals: number,
  investments: number,
  safeToSpend: number,
): MoneyFlowBreakdownLine[] {
  return [
    {
      id: "income",
      label: "Income",
      amount: income,
      percentOfIncome: income > 0 ? 100 : 0,
      isOutflow: false,
    },
    {
      id: "bills",
      label: "Bills",
      amount: bills,
      percentOfIncome: percentOfIncome(bills, income),
      isOutflow: true,
    },
    {
      id: "debts",
      label: "Debt Payments",
      amount: debts,
      percentOfIncome: percentOfIncome(debts, income),
      isOutflow: true,
    },
    {
      id: "goals",
      label: "Goals",
      amount: goals,
      percentOfIncome: percentOfIncome(goals, income),
      isOutflow: true,
    },
    {
      id: "investments",
      label: "Investments",
      amount: investments,
      percentOfIncome: percentOfIncome(investments, income),
      isOutflow: true,
    },
    {
      id: "safeToSpend",
      label: "Safe To Spend",
      amount: safeToSpend,
      percentOfIncome: percentOfIncome(safeToSpend, income),
      isOutflow: false,
    },
  ];
}

export function calculateMoneyFlow(data: FinanceData): MoneyFlowResult {
  const income = calculateMonthlyIncome(data);
  const bills = calculateMonthlySpending(data);
  const afterBills = Math.max(income - bills, 0);

  const rawDebts = getTotalMinimumPayments(data);
  const debts = Math.min(rawDebts, afterBills);
  const afterDebts = Math.max(afterBills - debts, 0);

  const rawGoals = calculateRawGoalContributions(data);
  const goals = Math.min(rawGoals, afterDebts);
  const afterGoals = Math.max(afterDebts - goals, 0);

  const rawInvestments = calculateRawInvestmentContributions(data);
  const investments = Math.min(rawInvestments, afterGoals);
  const projectedSafeToSpend = Math.max(
    income - bills - debts - goals - investments,
    0,
  );
  const availableCash = calculateAvailableCash(data);
  const safeToSpend =
    hasPlaidLinkedCashAccounts(data) && availableCash >= 0
      ? Math.min(projectedSafeToSpend, availableCash)
      : projectedSafeToSpend;

  return {
    income,
    bills,
    debts,
    goals,
    investments,
    safeToSpend,
    stages: buildStages(income, bills, debts, goals, investments, safeToSpend),
    breakdown: buildBreakdown(
      income,
      bills,
      debts,
      goals,
      investments,
      safeToSpend,
    ),
  };
}
