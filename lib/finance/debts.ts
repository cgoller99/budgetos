import { calculateCash } from "@/lib/calculations/netWorth";
import {
  getCurrentYearMonth,
  getDueDateForMonth,
  startOfDay,
} from "@/lib/finance/bills";
import type {
  Debt,
  DebtAccountType,
  DebtsDashboardSummary,
  DebtStrategy,
  DebtStrategyInsight,
  DebtTableRow,
  FinanceData,
} from "@/lib/finance/types";

const MS_PER_DAY = 86_400_000;
const DEFAULT_EXTRA_PAYMENT = 100;
const MAX_SIMULATION_MONTHS = 600;

export const DEBT_ACCOUNT_TYPE_LABELS: Record<DebtAccountType, string> = {
  credit_card: "Credit Card",
  personal_loan: "Personal Loan",
  student_loan: "Student Loan",
  auto_loan: "Auto Loan",
  mortgage: "Mortgage",
  medical: "Medical",
  other: "Other",
};

export const DEBT_ACCOUNT_TYPE_OPTIONS: {
  value: DebtAccountType;
  label: string;
}[] = Object.entries(DEBT_ACCOUNT_TYPE_LABELS).map(([value, label]) => ({
  value: value as DebtAccountType,
  label,
}));

type SimulationDebt = {
  id: string;
  name: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
};

type PayoffSimulation = {
  months: number;
  totalInterest: number;
  debtFreeDate: Date;
};

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return startOfDay(next);
}

function daysUntil(date: Date, referenceDate: Date): number {
  const today = startOfDay(referenceDate);
  const target = startOfDay(date);
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
}

export function inferDebtAccountType(name: string): DebtAccountType {
  const normalized = name.toLowerCase();

  if (normalized.includes("credit")) {
    return "credit_card";
  }

  if (normalized.includes("student")) {
    return "student_loan";
  }

  if (normalized.includes("auto") || normalized.includes("car")) {
    return "auto_loan";
  }

  if (normalized.includes("mortgage") || normalized.includes("home")) {
    return "mortgage";
  }

  if (normalized.includes("medical")) {
    return "medical";
  }

  if (normalized.includes("loan")) {
    return "personal_loan";
  }

  return "other";
}

export function getDebtAccountTypeLabel(accountType: DebtAccountType): string {
  return DEBT_ACCOUNT_TYPE_LABELS[accountType] ?? "Other";
}

export function getTotalDebtBalance(data: FinanceData): number {
  return sum((data.debts ?? []).map((debt) => debt.balance));
}

export function getTotalMinimumPayments(data: FinanceData): number {
  return sum((data.debts ?? []).map((debt) => debt.minimumPayment));
}

export function calculateDebtPaydownProgress(debt: Debt): number {
  if (debt.originalBalance <= 0) {
    return debt.balance <= 0 ? 100 : 0;
  }

  const paidOff = debt.originalBalance - debt.balance;
  return Math.max(0, Math.min(100, (paidOff / debt.originalBalance) * 100));
}

export function getDebtFreeProgress(data: FinanceData): number {
  const debts = (data.debts ?? []).filter((debt) => debt.balance > 0);

  if (debts.length === 0) {
    return 100;
  }

  const originalTotal = sum(
    debts.map((debt) => Math.max(debt.originalBalance, debt.balance)),
  );

  if (originalTotal <= 0) {
    return 0;
  }

  const remaining = sum(debts.map((debt) => debt.balance));
  return Math.max(0, Math.min(100, ((originalTotal - remaining) / originalTotal) * 100));
}

export function formatDebtDueDate(
  dueDay: number,
  referenceDate = new Date(),
): string {
  if (dueDay <= 0) {
    return "Flexible";
  }

  const dueDate = getDueDateForMonth(dueDay, referenceDate);

  if (!dueDate) {
    return "—";
  }

  return dueDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function estimateInterestPaidThisYear(
  debts: Debt[],
  referenceDate = new Date(),
): number {
  const monthsElapsed = referenceDate.getMonth() + 1;

  return debts.reduce((total, debt) => {
    if (debt.balance <= 0 || debt.interestRate <= 0) {
      return total;
    }

    const monthlyRate = debt.interestRate / 100 / 12;
    const principalPaid = Math.max(
      0,
      Math.abs(debt.monthlyChange) - debt.balance * monthlyRate,
    );
    const averageBalance =
      debt.balance + (principalPaid * monthsElapsed) / 2;

    return total + averageBalance * monthlyRate * monthsElapsed;
  }, 0);
}

function toSimulationDebt(debt: Debt): SimulationDebt {
  return {
    id: debt.id,
    name: debt.name,
    balance: debt.balance,
    interestRate: debt.interestRate,
    minimumPayment: debt.minimumPayment,
  };
}

function pickStrategyTarget(
  debts: SimulationDebt[],
  strategy: DebtStrategy,
): SimulationDebt | null {
  const active = debts.filter((debt) => debt.balance > 0.01);

  if (active.length === 0) {
    return null;
  }

  if (strategy === "snowball") {
    return [...active].sort((left, right) => left.balance - right.balance)[0];
  }

  return [...active].sort(
    (left, right) => right.interestRate - left.interestRate,
  )[0];
}

export function simulateDebtPayoff(
  debts: Debt[],
  strategy: DebtStrategy,
  extraMonthly = 0,
  referenceDate = new Date(),
): PayoffSimulation {
  const state = (debts ?? [])
    .filter((debt) => debt.balance > 0)
    .map(toSimulationDebt);

  if (state.length === 0) {
    return {
      months: 0,
      totalInterest: 0,
      debtFreeDate: startOfDay(referenceDate),
    };
  }

  let months = 0;
  let totalInterest = 0;

  while (state.some((debt) => debt.balance > 0.01) && months < MAX_SIMULATION_MONTHS) {
    months += 1;

    for (const debt of state) {
      if (debt.balance <= 0.01) {
        continue;
      }

      const interest = debt.balance * (debt.interestRate / 100 / 12);
      totalInterest += interest;
      debt.balance += interest;
    }

    for (const debt of state) {
      if (debt.balance <= 0.01) {
        continue;
      }

      const payment = Math.min(debt.minimumPayment, debt.balance);
      debt.balance -= payment;
    }

    let remainingExtra = extraMonthly;
    const target = pickStrategyTarget(state, strategy);

    if (target && remainingExtra > 0) {
      const applied = Math.min(remainingExtra, target.balance);
      target.balance -= applied;
      remainingExtra -= applied;
    }
  }

  return {
    months,
    totalInterest,
    debtFreeDate: addMonths(referenceDate, months),
  };
}

export function formatDebtFreeDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export function getRecommendedDebt(
  data: FinanceData,
  strategy: DebtStrategy,
): Debt | null {
  const active = (data.debts ?? []).filter((debt) => debt.balance > 0);

  if (active.length === 0) {
    return null;
  }

  const simulated = active.map(toSimulationDebt);
  const target = pickStrategyTarget(simulated, strategy);

  if (!target) {
    return null;
  }

  return active.find((debt) => debt.id === target.id) ?? null;
}

export function getDebtStrategyInsight(
  data: FinanceData,
  strategy: DebtStrategy,
  extraMonthly = DEFAULT_EXTRA_PAYMENT,
  referenceDate = new Date(),
): DebtStrategyInsight {
  const debts = data.debts ?? [];
  const baseline = simulateDebtPayoff(debts, strategy, 0, referenceDate);
  const accelerated = simulateDebtPayoff(
    debts,
    strategy,
    extraMonthly,
    referenceDate,
  );
  const recommended = getRecommendedDebt(data, strategy);

  return {
    strategy,
    recommendedDebt: recommended
      ? {
          id: recommended.id,
          name: recommended.name,
          balance: recommended.balance,
          interestRate: recommended.interestRate,
        }
      : null,
    extraPayment: extraMonthly,
    monthsSaved: Math.max(0, baseline.months - accelerated.months),
    interestSaved: Math.max(0, baseline.totalInterest - accelerated.totalInterest),
    estimatedPayoffDate: formatDebtFreeDate(accelerated.debtFreeDate),
    baselinePayoffDate: formatDebtFreeDate(baseline.debtFreeDate),
  };
}

export function getNextDebtPayment(
  data: FinanceData,
  referenceDate = new Date(),
): DebtsDashboardSummary["nextPayment"] {
  const candidates = (data.debts ?? [])
    .filter((debt) => debt.balance > 0 && debt.minimumPayment > 0)
    .map((debt) => {
      const dueDate = getDueDateForMonth(debt.dueDay, referenceDate);

      return {
        id: debt.id,
        name: debt.name,
        amount: debt.minimumPayment,
        dueDate,
        formattedDueDate: formatDebtDueDate(debt.dueDay, referenceDate),
      };
    })
    .filter((debt) => debt.dueDate);

  if (candidates.length === 0) {
    const fallback = (data.debts ?? []).find(
      (debt) => debt.balance > 0 && debt.minimumPayment > 0,
    );

    if (!fallback) {
      return null;
    }

    return {
      id: fallback.id,
      name: fallback.name,
      amount: fallback.minimumPayment,
      dueDate: formatDebtDueDate(fallback.dueDay, referenceDate),
      daysUntilDue: 0,
    };
  }

  const next = [...candidates].sort(
    (left, right) => left.dueDate!.getTime() - right.dueDate!.getTime(),
  )[0];

  return {
    id: next.id,
    name: next.name,
    amount: next.amount,
    dueDate: next.formattedDueDate,
    daysUntilDue: daysUntil(next.dueDate!, referenceDate),
  };
}

export function getDebtsDashboardSummary(
  data: FinanceData,
  referenceDate = new Date(),
): DebtsDashboardSummary {
  const debts = data.debts ?? [];
  const activeDebts = debts.filter((debt) => debt.balance > 0);
  const baseline = simulateDebtPayoff(debts, "avalanche", 0, referenceDate);

  return {
    totalDebt: getTotalDebtBalance(data),
    totalMinimumPayments: getTotalMinimumPayments(data),
    estimatedDebtFreeDate: formatDebtFreeDate(baseline.debtFreeDate),
    interestPaidThisYear: estimateInterestPaidThisYear(debts, referenceDate),
    nextPayment: getNextDebtPayment(data, referenceDate),
    debtFreeProgress: getDebtFreeProgress(data),
    activeDebtCount: activeDebts.length,
  };
}

export function enrichDebtRow(
  debt: Debt,
  referenceDate = new Date(),
): DebtTableRow {
  const progressPercent = calculateDebtPaydownProgress(debt);

  return {
    id: debt.id,
    name: debt.name,
    balance: debt.balance,
    interestRate: debt.interestRate,
    minimumPayment: debt.minimumPayment,
    dueDate: formatDebtDueDate(debt.dueDay, referenceDate),
    accountType: debt.accountType,
    accountTypeLabel: getDebtAccountTypeLabel(debt.accountType),
    progressPercent,
    progressLabel: `${Math.round(progressPercent)}% paid`,
  };
}

export function getDebtTableRows(
  data: FinanceData,
  referenceDate = new Date(),
): DebtTableRow[] {
  return (data.debts ?? [])
    .map((debt) => enrichDebtRow(debt, referenceDate))
    .sort((left, right) => {
      if (left.balance <= 0 && right.balance > 0) {
        return 1;
      }

      if (right.balance <= 0 && left.balance > 0) {
        return -1;
      }

      return right.interestRate - left.interestRate;
    });
}

export function calculateDebtUtilization(data: FinanceData): number {
  const totalDebt = getTotalDebtBalance(data);
  const liquidAssets = calculateCash(data).value;
  const denominator = totalDebt + liquidAssets;

  if (denominator <= 0) {
    return 0;
  }

  return totalDebt / denominator;
}

export function formatDebtUtilizationLabel(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function buildUpdatedDebt(
  existing: Debt,
  input: {
    name: string;
    balance: number;
    interestRate: number;
    minimumPayment: number;
    dueDay: number;
    accountType: DebtAccountType;
  },
): Debt {
  const originalBalance =
    input.balance > existing.balance
      ? input.balance
      : Math.max(existing.originalBalance, input.balance);

  return {
    ...existing,
    name: input.name.trim(),
    balance: input.balance,
    originalBalance,
    interestRate: input.interestRate,
    minimumPayment: input.minimumPayment,
    dueDay: input.dueDay,
    accountType: input.accountType,
    monthlyChange: existing.monthlyChange,
  };
}

export { getCurrentYearMonth };
