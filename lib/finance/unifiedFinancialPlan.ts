/**
 * One connected Income Plan projection for Budgets, Goals, Debt, STS, and outlook.
 * Amounts are planned (not confirmed). Stable IDs drive relationships — not labels.
 */
import { filterPersonalIncomePlan } from "@/lib/finance/personalIncomeScope";
import {
  EXTRA_DEBT_ALLOCATION_NAME,
  isDebtLinkedAllocation,
  monthlyAmountFromSchedule,
} from "@/lib/finance/debtPayoff";
import { buildPaycheckPlanSummary, type PaycheckPlanSummary } from "@/lib/finance/paycheckPlanSummary";
import { weeklySavingsFromPaycheckAmount } from "@/lib/finance/goalForecast";
import { resolveAllocationAmounts } from "@/lib/incomePlan/allocations";
import type { IncomePlanSchedule } from "@/lib/incomePlan/types";
import type { FinanceData } from "@/lib/finance/types";

export type FinancialValueKind = "actual" | "planned" | "projected" | "simulated";

export type UnifiedGoalPlan = {
  goalId: string;
  name: string;
  perPaycheck: number;
  weekly: number;
  monthly: number;
  kind: FinancialValueKind;
};

export type UnifiedDebtExtraPlan = {
  debtId: string;
  name: string;
  perPaycheck: number;
  monthly: number;
  kind: FinancialValueKind;
};

export type UnifiedFinancialPlan = {
  hasActivePlan: boolean;
  expectedPaycheck: number;
  paySchedule: IncomePlanSchedule | null;
  paycheck: PaycheckPlanSummary | null;
  /** Planned goal contributions keyed by goalId (Income Plan only). */
  goals: UnifiedGoalPlan[];
  /** Planned extra debt payments keyed by debtId. */
  debtExtras: UnifiedDebtExtraPlan[];
  billsAllocated: number;
  savingsGoalAllocations: number;
  extraDebtPayments: number;
  flexibleSpendingAllocations: number;
  remainingUnallocated: number;
  /** Monthly equivalent of all Income Plan goal allocations. */
  plannedGoalMonthly: number;
  /** Monthly equivalent of tagged extra debt payments. */
  plannedExtraDebtMonthly: number;
  explanation: string;
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Resolve the active Income Plan into one ID-keyed projection shared across screens.
 * Does not invent cash or increase actual savings/debt balances.
 */
export function buildUnifiedFinancialPlan(
  data: FinanceData,
  options?: { confirmedPaycheckAmount?: number | null },
): UnifiedFinancialPlan {
  const plan = filterPersonalIncomePlan(data.incomePlan, data.viewerUserId ?? null);
  const paycheck = buildPaycheckPlanSummary(data, options);

  if (!plan?.isActive || !paycheck) {
    return {
      hasActivePlan: false,
      expectedPaycheck: 0,
      paySchedule: plan?.paySchedule ?? null,
      paycheck: null,
      goals: [],
      debtExtras: [],
      billsAllocated: 0,
      savingsGoalAllocations: 0,
      extraDebtPayments: 0,
      flexibleSpendingAllocations: 0,
      remainingUnallocated: 0,
      plannedGoalMonthly: 0,
      plannedExtraDebtMonthly: 0,
      explanation:
        "No active Income Plan. Safe to Spend still uses income, bills, debts, and cash ceilings.",
    };
  }

  const resolved = resolveAllocationAmounts({
    paycheckAmount: paycheck.confirmedPaycheck ?? paycheck.expectedPaycheck,
    allocations: plan.allocations,
  });

  const goalById = new Map<string, UnifiedGoalPlan>();
  const debtById = new Map<string, UnifiedDebtExtraPlan>();

  for (const item of resolved) {
    const allocation = item.allocation;
    if (item.amount <= 0 || allocation.isRemainingBalance) {
      continue;
    }

    if (allocation.goalId) {
      const goal = (data.savingsGoals ?? []).find((g) => g.id === allocation.goalId);
      const weekly =
        weeklySavingsFromPaycheckAmount(
          item.amount,
          plan.paySchedule,
          plan.customIntervalDays,
        ) ?? 0;
      const monthly = monthlyAmountFromSchedule(
        item.amount,
        plan.paySchedule,
        plan.customIntervalDays,
      );
      const existing = goalById.get(allocation.goalId);
      goalById.set(allocation.goalId, {
        goalId: allocation.goalId,
        name: goal?.name ?? allocation.name,
        perPaycheck: round((existing?.perPaycheck ?? 0) + item.amount),
        weekly: round((existing?.weekly ?? 0) + weekly),
        monthly: round((existing?.monthly ?? 0) + monthly),
        kind: "planned",
      });
      continue;
    }

    if (isDebtLinkedAllocation(allocation)) {
      const debtId = allocation.debtId!;
      const debt = (data.debts ?? []).find((d) => d.id === debtId);
      const monthly = monthlyAmountFromSchedule(
        item.amount,
        plan.paySchedule,
        plan.customIntervalDays,
      );
      // Debt-linked rows are included by debtId. Tagged planner extras
      // (EXTRA_DEBT_ALLOCATION_NAME) count fully; other debt-linked amounts are
      // still surfaced here for UI — STS/debt engines apply minimum-aware math.
      const existing = debtById.get(debtId);
      const label =
        allocation.name === EXTRA_DEBT_ALLOCATION_NAME
          ? debt?.name ?? allocation.name
          : debt?.name ?? allocation.name;
      debtById.set(debtId, {
        debtId,
        name: label,
        perPaycheck: round((existing?.perPaycheck ?? 0) + item.amount),
        monthly: round((existing?.monthly ?? 0) + monthly),
        kind: "planned",
      });
    }
  }

  const goals = [...goalById.values()].sort((a, b) => a.name.localeCompare(b.name));
  const debtExtras = [...debtById.values()].sort((a, b) => a.name.localeCompare(b.name));

  return {
    hasActivePlan: true,
    expectedPaycheck: paycheck.expectedPaycheck,
    paySchedule: plan.paySchedule,
    paycheck,
    goals,
    debtExtras,
    billsAllocated: paycheck.billsAllocated,
    savingsGoalAllocations: paycheck.savingsGoalAllocations,
    extraDebtPayments: paycheck.extraDebtPayments,
    flexibleSpendingAllocations: paycheck.flexibleSpendingAllocations,
    remainingUnallocated: paycheck.remainingUnallocated,
    plannedGoalMonthly: round(goals.reduce((total, goal) => total + goal.monthly, 0)),
    plannedExtraDebtMonthly: round(
      debtExtras.reduce((total, debt) => total + debt.monthly, 0),
    ),
    explanation:
      "Paycheck rows are planned commitments by stable goalId/debtId/billId. Confirmed paychecks update actual balances; editing the plan never invents cash or savings.",
  };
}

/** Planned weekly Income Plan contribution for one goal (0 if none). */
export function plannedGoalWeekly(data: FinanceData, goalId: string): number {
  const unified = buildUnifiedFinancialPlan(data);
  return unified.goals.find((goal) => goal.goalId === goalId)?.weekly ?? 0;
}

/**
 * Monthly goal reservation for Safe to Spend waterfall.
 * Prefer Income Plan goal allocations by ID; fall back to remaining/12 for unplanned goals.
 */
export function plannedOrHeuristicGoalMonthly(data: FinanceData): number {
  const unified = buildUnifiedFinancialPlan(data);
  const plannedIds = new Set(unified.goals.map((goal) => goal.goalId));
  let total = unified.plannedGoalMonthly;

  for (const goal of data.savingsGoals ?? []) {
    if (goal.current >= goal.target || plannedIds.has(goal.id)) {
      continue;
    }
    const remaining = Math.max(goal.target - goal.current, 0);
    total += Math.ceil(remaining / 12);
  }

  return round(total);
}
