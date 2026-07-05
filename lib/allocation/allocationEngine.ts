import type {
  IncomePlan,
  IncomePlanAllocation,
  ResolvedAllocation,
} from "@/lib/incomePlan/types";
import type { AllocationType } from "@/lib/allocation/types";

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getAllocationType(
  allocation: Pick<
    IncomePlanAllocation,
    "allocationType" | "isRemainingBalance" | "percentage"
  >,
): AllocationType {
  if (allocation.allocationType) {
    return allocation.allocationType;
  }

  if (allocation.isRemainingBalance) {
    return "remaining";
  }

  if (
    allocation.percentage !== null &&
    allocation.percentage !== undefined &&
    allocation.percentage > 0
  ) {
    return "percentage";
  }

  return "fixed";
}

export function resolveAllocations(
  plan: Pick<IncomePlan, "paycheckAmount" | "allocations">,
  customAmounts?: Record<string, number>,
): ResolvedAllocation[] {
  const sorted = [...plan.allocations].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );
  const remaining = sorted.find(
    (item) => getAllocationType(item) === "remaining",
  );
  const fixed = sorted.filter((item) => getAllocationType(item) === "fixed");
  const percentages = sorted.filter(
    (item) => getAllocationType(item) === "percentage",
  );

  const resolved: ResolvedAllocation[] = [];

  const fixedTotal = fixed.reduce((total, allocation) => {
    const amount = roundCurrency(
      customAmounts?.[allocation.id] ?? allocation.amount ?? 0,
    );
    resolved.push({ allocation, amount });
    return total + amount;
  }, 0);

  const percentageTotal = percentages.reduce((total, allocation) => {
    const pct = allocation.percentage ?? 0;
    const amount = roundCurrency(plan.paycheckAmount * (pct / 100));
    resolved.push({ allocation, amount });
    return total + amount;
  }, 0);

  if (remaining) {
    resolved.push({
      allocation: remaining,
      amount: roundCurrency(
        Math.max(plan.paycheckAmount - fixedTotal - percentageTotal, 0),
      ),
    });
  }

  return resolved.sort(
    (left, right) => left.allocation.sortOrder - right.allocation.sortOrder,
  );
}

export function getAllocationSummaryFromPlan(
  paycheckAmount: number,
  allocations: IncomePlanAllocation[],
): {
  paycheckAmount: number;
  fixedAllocated: number;
  percentageAllocated: number;
  allocated: number;
  remaining: number;
  isOverAllocated: boolean;
  overBy: number;
  remainingBalanceCount: number;
  percentageTotal: number;
} {
  const remainingBalanceCount = allocations.filter(
    (item) => getAllocationType(item) === "remaining",
  ).length;

  const fixedAllocated = roundCurrency(
    allocations
      .filter((item) => getAllocationType(item) === "fixed")
      .reduce((total, item) => total + (item.amount ?? 0), 0),
  );

  const percentageTotal = roundCurrency(
    allocations
      .filter((item) => getAllocationType(item) === "percentage")
      .reduce((total, item) => total + (item.percentage ?? 0), 0),
  );

  const percentageAllocated = roundCurrency(
    paycheckAmount * (percentageTotal / 100),
  );

  const allocated = roundCurrency(fixedAllocated + percentageAllocated);
  const remaining = roundCurrency(paycheckAmount - allocated);
  const isOverAllocated = remaining < 0 && remainingBalanceCount === 0;

  return {
    paycheckAmount: roundCurrency(paycheckAmount),
    fixedAllocated,
    percentageAllocated,
    allocated,
    remaining,
    isOverAllocated,
    overBy: isOverAllocated ? roundCurrency(Math.abs(remaining)) : 0,
    remainingBalanceCount,
    percentageTotal,
  };
}

export function validateAllocationPlan(
  paycheckAmount: number,
  allocations: IncomePlanAllocation[],
): string | null {
  const summary = getAllocationSummaryFromPlan(paycheckAmount, allocations);

  if (summary.remainingBalanceCount > 1) {
    return "Only one category can be Remaining Balance.";
  }

  if (summary.remainingBalanceCount === 0) {
    return "Choose one category as Remaining Balance.";
  }

  if (summary.percentageTotal > 100) {
    return "Percentage allocations cannot exceed 100%.";
  }

  if (summary.isOverAllocated) {
    return `Your allocations exceed this paycheck by $${summary.overBy.toFixed(2)}.`;
  }

  return null;
}

/** @deprecated Use resolveAllocations — kept for backward compatibility. */
export const resolveAllocationAmounts = resolveAllocations;
