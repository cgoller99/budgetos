import type {
  IncomePlan,
  IncomePlanAllocation,
  IncomePlanAllocationProgress,
  IncomePlanPaycheckEvent,
  ResolvedAllocation,
} from "@/lib/incomePlan/types";
import type { AllocationType } from "@/lib/allocation/types";
import {
  getAllocationType,
  resolveAllocations,
  validateAllocationPlan,
  getAllocationSummaryFromPlan,
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

export type AllocationDraftFields = Omit<IncomePlanAllocation, "id"> & {
  id?: string;
};

export function allocationAmountInputValue(
  allocation: Pick<
    IncomePlanAllocation,
    "amount" | "percentage" | "allocationType" | "isRemainingBalance"
  >,
): string {
  if (getAllocationType(allocation) !== "fixed") {
    return "";
  }

  return formatAllocationAmountInput(allocation.amount);
}

export function allocationPercentInputValue(
  allocation: Pick<
    IncomePlanAllocation,
    "amount" | "percentage" | "allocationType" | "isRemainingBalance"
  >,
): string {
  if (getAllocationType(allocation) !== "percentage") {
    return "";
  }

  if (
    allocation.percentage === null ||
    allocation.percentage === undefined ||
    allocation.percentage === 0
  ) {
    return "";
  }

  return String(allocation.percentage);
}

/**
 * Applies the visible amount fields using allocation type, not a stale dollar
 * value hidden behind a percentage or remaining row.
 */
export function applyAllocationInputs<T extends AllocationDraftFields>(
  allocation: T,
  amountText: string,
  percentText: string,
): T {
  const type = getAllocationType(allocation);

  if (type === "remaining") {
    return {
      ...allocation,
      amount: null,
      percentage: null,
      allocationType: "remaining",
      isRemainingBalance: true,
    };
  }

  if (type === "percentage") {
    return {
      ...allocation,
      amount: null,
      percentage: parseAllocationAmountInput(percentText),
      allocationType: "percentage",
      isRemainingBalance: false,
    };
  }

  return {
    ...allocation,
    amount: parseAllocationAmountInput(amountText),
    percentage: null,
    allocationType: "fixed",
    isRemainingBalance: false,
  };
}

export function setAllocationModeOnDraft<T extends AllocationDraftFields>(
  allocations: T[],
  index: number,
  mode: AllocationType,
): T[] {
  return allocations.map((item, itemIndex) => {
    if (mode === "remaining") {
      if (itemIndex === index) {
        return {
          ...item,
          allocationType: "remaining",
          isRemainingBalance: true,
          amount: null,
          percentage: null,
        };
      }

      if (getAllocationType(item) === "remaining") {
        return {
          ...item,
          allocationType: "fixed",
          isRemainingBalance: false,
        };
      }

      return { ...item, isRemainingBalance: false };
    }

    if (itemIndex !== index) {
      return item;
    }

    if (mode === "percentage") {
      return {
        ...item,
        allocationType: "percentage",
        isRemainingBalance: false,
        amount: null,
      };
    }

    return {
      ...item,
      allocationType: "fixed",
      isRemainingBalance: false,
      percentage: null,
    };
  });
}

export function getAllocationSummary(
  paycheckAmount: number,
  allocations: Array<
    Pick<
      IncomePlanAllocation,
      "amount" | "isRemainingBalance" | "percentage" | "allocationType"
    >
  >,
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
  const summary = getAllocationSummaryFromPlan(
    paycheckAmount,
    allocations.map((item, index) => ({
      id: `summary-${index}`,
      name: "",
      icon: "",
      amount: item.amount,
      percentage: item.percentage ?? null,
      allocationType: item.allocationType ?? null,
      isRemainingBalance: item.isRemainingBalance,
      accountId: null,
      goalId: null,
      monthlyTarget: null,
      sortOrder: index,
    })),
  );
  const isOverAllocated = summary.remaining < 0;

  return {
    ...summary,
    isOverAllocated,
    overBy: isOverAllocated ? roundCurrency(Math.abs(summary.remaining)) : 0,
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
