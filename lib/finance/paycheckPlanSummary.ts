import { filterPersonalIncomePlan } from "@/lib/finance/personalIncomeScope";
import { resolveAllocationAmounts } from "@/lib/incomePlan/allocations";
import type { FinanceData } from "@/lib/finance/types";
import type { IncomePlanSchedule } from "@/lib/incomePlan/types";

export type PaycheckPlanBucket = {
  id: string;
  label: string;
  amount: number;
  kind: "bill" | "debt" | "debt_extra" | "goal" | "flexible" | "remaining" | "other";
  goalId?: string | null;
  debtId?: string | null;
  billId?: string | null;
};

export type PaycheckPlanSummary = {
  expectedPaycheck: number;
  confirmedPaycheck: number | null;
  buckets: PaycheckPlanBucket[];
  billsAllocated: number;
  requiredDebtPayments: number;
  extraDebtPayments: number;
  savingsGoalAllocations: number;
  flexibleSpendingAllocations: number;
  remainingUnallocated: number;
  totalAllocated: number;
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function monthlyMinimumsToPaycheck(
  monthlyMinimums: number,
  schedule: IncomePlanSchedule,
  customIntervalDays: number | null,
): number {
  if (monthlyMinimums <= 0) return 0;
  switch (schedule) {
    case "weekly":
      return round(monthlyMinimums / 4.33);
    case "biweekly":
      return round(monthlyMinimums / 2.165);
    case "twice_monthly":
      return round(monthlyMinimums / 2);
    case "custom":
      if (!customIntervalDays || customIntervalDays <= 0) return round(monthlyMinimums);
      return round((monthlyMinimums * customIntervalDays) / 30.44);
    default:
      return round(monthlyMinimums);
  }
}

/**
 * One shared paycheck allocation summary for Income Plan, Budgets, and Goals.
 * Amounts come from the Income Plan allocation engine — not duplicated budget math.
 */
export function buildPaycheckPlanSummary(
  data: FinanceData,
  options?: { confirmedPaycheckAmount?: number | null },
): PaycheckPlanSummary | null {
  const plan = filterPersonalIncomePlan(data.incomePlan, data.viewerUserId ?? null);
  if (!plan?.isActive || plan.paycheckAmount <= 0) {
    return null;
  }

  const expectedPaycheck = plan.paycheckAmount;
  const confirmedPaycheck =
    options?.confirmedPaycheckAmount != null &&
    Number.isFinite(options.confirmedPaycheckAmount)
      ? round(options.confirmedPaycheckAmount)
      : null;
  const baseAmount = confirmedPaycheck ?? expectedPaycheck;
  const resolved = resolveAllocationAmounts({
    paycheckAmount: baseAmount,
    allocations: plan.allocations,
  });

  const buckets: PaycheckPlanBucket[] = resolved.map((item) => {
    const allocation = item.allocation;
    let kind: PaycheckPlanBucket["kind"] = "other";
    if (allocation.isRemainingBalance) kind = "remaining";
    else if (allocation.goalId) kind = "goal";
    else if (allocation.debtId) kind = "debt_extra";
    else if (allocation.billId) kind = "bill";
    else kind = "flexible";
    return {
      id: allocation.id,
      label: allocation.name,
      amount: round(item.amount),
      kind,
      goalId: allocation.goalId ?? null,
      debtId: allocation.debtId ?? null,
      billId: allocation.billId ?? null,
    };
  });

  const billsAllocated = round(
    buckets.filter((b) => b.kind === "bill").reduce((t, b) => t + b.amount, 0),
  );
  const extraDebtPayments = round(
    buckets.filter((b) => b.kind === "debt_extra").reduce((t, b) => t + b.amount, 0),
  );
  const savingsGoalAllocations = round(
    buckets.filter((b) => b.kind === "goal").reduce((t, b) => t + b.amount, 0),
  );
  const flexibleSpendingAllocations = round(
    buckets.filter((b) => b.kind === "flexible").reduce((t, b) => t + b.amount, 0),
  );
  const remainingUnallocated = round(
    buckets.filter((b) => b.kind === "remaining").reduce((t, b) => t + b.amount, 0),
  );
  const totalAllocated = round(
    billsAllocated +
      extraDebtPayments +
      savingsGoalAllocations +
      flexibleSpendingAllocations,
  );

  const monthlyMinimums = (data.debts ?? []).reduce(
    (total, debt) => total + Math.max(0, debt.minimumPayment ?? 0),
    0,
  );
  const requiredDebtPayments = monthlyMinimumsToPaycheck(
    monthlyMinimums,
    plan.paySchedule,
    plan.customIntervalDays,
  );

  return {
    expectedPaycheck: round(expectedPaycheck),
    confirmedPaycheck,
    buckets,
    billsAllocated,
    requiredDebtPayments,
    extraDebtPayments,
    savingsGoalAllocations,
    flexibleSpendingAllocations,
    remainingUnallocated,
    totalAllocated,
  };
}
