import { calculateMonthlyIncome, calculateMonthlySpending } from "@/lib/calculations/cashFlow";
import {
  resolveCashAvailability,
  type CashAvailabilityStatus,
} from "@/lib/calculations/availableCash";
import { plannedExtraDebtMonthly } from "@/lib/finance/debtPayoff";
import { isPersonalOwnerRow } from "@/lib/finance/personalIncomeScope";
import type { FinanceData } from "@/lib/finance/types";
import { getTransactionsForMonth } from "@/lib/transactions";
import { isInternalTransferExpense } from "@/lib/transactions/transferDetection";

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
  /** Income-based STS before any cash ceiling. */
  projectedSafeToSpend: number;
  availableCash: number;
  cashAvailabilityStatus: CashAvailabilityStatus;
  cashAvailabilityReason: string | null;
  stages: MoneyFlowStage[];
  breakdown: MoneyFlowBreakdownLine[];
};

const GOAL_ALLOCATION_MONTHS = 12;

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Debt minimums are reserved once. A posted payment on that debt counts
 * toward the minimum, and only the amount above the minimum is extra.
 */
function reservedDebtPayments(data: FinanceData, referenceDate: Date): number {
  const paidByDebt = new Map<string, number>();
  for (const transaction of getTransactionsForMonth(data, referenceDate)) {
    if (
      transaction.type !== "expense" ||
      !transaction.debtId ||
      transaction.goalId ||
      transaction.amount <= 0 ||
      isInternalTransferExpense(data, transaction) ||
      !isPersonalOwnerRow(transaction.ownerUserId, data.viewerUserId)
    ) {
      continue;
    }
    paidByDebt.set(
      transaction.debtId,
      (paidByDebt.get(transaction.debtId) ?? 0) + transaction.amount,
    );
  }

  const activeIds = new Set<string>();
  let reserved = 0;
  let paidBeyondMinimum = 0;
  for (const debt of data.debts ?? []) {
    if (debt.balance <= 0.009) {
      continue;
    }
    activeIds.add(debt.id);
    const minimum = Math.max(debt.minimumPayment, 0);
    const posted = paidByDebt.get(debt.id) ?? 0;
    reserved += minimum;
    if (posted > minimum) {
      paidBeyondMinimum += posted - minimum;
    }
  }

  let orphanPayments = 0;
  for (const [debtId, amount] of paidByDebt) {
    if (!activeIds.has(debtId)) {
      orphanPayments += amount;
    }
  }

  const plannedExtra = plannedExtraDebtMonthly(data.incomePlan, data.debts ?? []);
  return roundCurrency(
    reserved + Math.max(plannedExtra, paidBeyondMinimum) + orphanPayments,
  );
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

export function calculateMoneyFlow(
  data: FinanceData,
  referenceDate = new Date(),
): MoneyFlowResult {
  const income = calculateMonthlyIncome(data, referenceDate);
  const bills = calculateMonthlySpending(data, referenceDate);
  const afterBills = Math.max(income - bills, 0);

  const rawDebts = reservedDebtPayments(data, referenceDate);
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
  const cash = resolveCashAvailability(data);
  // Always respect known/qualified spendable cash — including manual checking.
  // When no spendable cash can be determined, do not invent a large income-based
  // "safe" number; callers can still read projectedSafeToSpend for context.
  const safeToSpend =
    cash.status === "unavailable"
      ? 0
      : Math.min(projectedSafeToSpend, Math.max(cash.amount, 0));

  return {
    income,
    bills,
    debts,
    goals,
    investments,
    safeToSpend,
    projectedSafeToSpend,
    availableCash: cash.amount,
    cashAvailabilityStatus: cash.status,
    cashAvailabilityReason: cash.reason,
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
