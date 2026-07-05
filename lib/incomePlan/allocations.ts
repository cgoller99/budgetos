import type {
  IncomePlan,
  IncomePlanAllocation,
  IncomePlanAllocationProgress,
  IncomePlanPaycheckEvent,
  ResolvedAllocation,
} from "@/lib/incomePlan/types";
import {
  resolveAllocations,
  validateAllocationPlan,
} from "@/lib/allocation/allocationEngine";
import { getCurrentYearMonth } from "@/lib/finance/bills";

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function parseAllocationAmountInput(value: string): number {
  const trimmed = value.trim().replace(/[$,\s]/g, "");

  if (!trimmed || trimmed === "." || trimmed === "-") {
    return 0;
  }

  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? roundCurrency(Math.max(parsed, 0)) : 0;
}

export function formatAllocationAmountInput(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return "";
  }

  return amount === 0 ? "" : String(amount);
}

export function getAllocationSummary(
  paycheckAmount: number,
  allocations: Pick<
    IncomePlanAllocation,
    "amount" | "isRemainingBalance"
  >[],
): {
  paycheckAmount: number;
  fixedAllocated: number;
  allocated: number;
  remaining: number;
  isOverAllocated: boolean;
  overBy: number;
  remainingBalanceCount: number;
} {
  const remainingBalanceCount = allocations.filter(
    (item) => item.isRemainingBalance,
  ).length;

  const allocated = roundCurrency(
    allocations
      .filter((item) => !item.isRemainingBalance)
      .reduce((total, item) => total + (item.amount ?? 0), 0),
  );

  const remaining = roundCurrency(paycheckAmount - allocated);
  const isOverAllocated = remaining < 0;

  return {
    paycheckAmount: roundCurrency(paycheckAmount),
    fixedAllocated: allocated,
    allocated,
    remaining,
    isOverAllocated,
    overBy: isOverAllocated ? roundCurrency(Math.abs(remaining)) : 0,
    remainingBalanceCount,
  };
}

export function validateAllocations(
  paycheckAmount: number,
  allocations: Pick<
    IncomePlanAllocation,
    "amount" | "isRemainingBalance" | "percentage" | "allocationType"
  >[],
): string | null {
  return validateAllocationPlan(
    paycheckAmount,
    allocations as IncomePlanAllocation[],
  );
}

export function resolveAllocationAmounts(
  plan: Pick<IncomePlan, "paycheckAmount" | "allocations">,
  customAmounts?: Record<string, number>,
): ResolvedAllocation[] {
  return resolveAllocations(plan, customAmounts);
}

export function getDefaultMonthlyTarget(
  allocation: IncomePlanAllocation,
  paychecksPerMonth: number,
  plan?: Pick<IncomePlan, "paycheckAmount" | "allocations">,
): number {
  if (allocation.monthlyTarget !== null) {
    return allocation.monthlyTarget;
  }

  if (allocation.isRemainingBalance) {
    if (!plan) {
      return 0;
    }

    const fixedTotal = plan.allocations
      .filter((item) => !item.isRemainingBalance)
      .reduce((total, item) => total + (item.amount ?? 0), 0);

    return roundCurrency(
      Math.max(plan.paycheckAmount - fixedTotal, 0) * paychecksPerMonth,
    );
  }

  return roundCurrency((allocation.amount ?? 0) * paychecksPerMonth);
}

export function getAllocationProgress(
  plan: IncomePlan,
  paycheckEvents: IncomePlanPaycheckEvent[],
  referenceDate = new Date(),
): IncomePlanAllocationProgress[] {
  const monthKey = getCurrentYearMonth(referenceDate);
  const eventsThisMonth = paycheckEvents.filter((event) =>
    event.payDate.startsWith(monthKey),
  );

  return plan.allocations.map((allocation) => {
    const receivedThisMonth = eventsThisMonth.reduce((total, event) => {
      const match = event.allocationEvents.find(
        (item) => item.allocationId === allocation.id,
      );
      return total + (match?.amount ?? 0);
    }, 0);

    const paychecksPerMonth =
      plan.paySchedule === "weekly"
        ? 4
        : plan.paySchedule === "biweekly"
          ? 2
          : plan.paySchedule === "twice_monthly"
            ? 2
            : 1;

    return {
      allocationId: allocation.id,
      name: allocation.name,
      icon: allocation.icon,
      receivedThisMonth: roundCurrency(receivedThisMonth),
      monthlyTarget: getDefaultMonthlyTarget(allocation, paychecksPerMonth, plan),
    };
  });
}

export function suggestAllocationIcons(name: string): string {
  const normalized = name.toLowerCase();

  if (normalized.includes("house") || normalized.includes("home")) return "🏠";
  if (normalized.includes("vacation") || normalized.includes("travel")) return "✈️";
  if (normalized.includes("emergency")) return "🛡️";
  if (normalized.includes("debt") || normalized.includes("loan")) return "💳";
  if (normalized.includes("invest")) return "📈";
  if (normalized.includes("spend")) return "🛍️";
  if (normalized.includes("save")) return "💰";

  return "💵";
}
