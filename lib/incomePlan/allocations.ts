import type {
  IncomePlan,
  IncomePlanAllocation,
  IncomePlanAllocationProgress,
  IncomePlanPaycheckEvent,
  ResolvedAllocation,
} from "@/lib/incomePlan/types";
import { getCurrentYearMonth } from "@/lib/finance/bills";

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function validateAllocations(
  paycheckAmount: number,
  allocations: Pick<
    IncomePlanAllocation,
    "amount" | "isRemainingBalance"
  >[],
): string | null {
  const remainingCount = allocations.filter(
    (item) => item.isRemainingBalance,
  ).length;

  if (remainingCount > 1) {
    return "Only one category can be Remaining Balance.";
  }

  const fixedTotal = allocations
    .filter((item) => !item.isRemainingBalance)
    .reduce((total, item) => total + (item.amount ?? 0), 0);

  if (fixedTotal > paycheckAmount) {
    return "Fixed allocations cannot exceed your paycheck amount.";
  }

  if (remainingCount === 0 && fixedTotal < paycheckAmount) {
    return "Add a Remaining Balance category or allocate the full paycheck.";
  }

  return null;
}

export function resolveAllocationAmounts(
  plan: Pick<IncomePlan, "paycheckAmount" | "allocations">,
  customAmounts?: Record<string, number>,
): ResolvedAllocation[] {
  const sorted = [...plan.allocations].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );
  const remaining = sorted.find((item) => item.isRemainingBalance);
  const fixed = sorted.filter((item) => !item.isRemainingBalance);

  const fixedTotal = fixed.reduce((total, item) => {
    const override = customAmounts?.[item.id];
    const amount = override ?? item.amount ?? 0;
    return total + amount;
  }, 0);

  const remainingAmount = roundCurrency(
    Math.max(plan.paycheckAmount - fixedTotal, 0),
  );

  const resolved: ResolvedAllocation[] = fixed.map((allocation) => ({
    allocation,
    amount: roundCurrency(customAmounts?.[allocation.id] ?? allocation.amount ?? 0),
  }));

  if (remaining) {
    resolved.push({
      allocation: remaining,
      amount: remainingAmount,
    });
  }

  return resolved;
}

export function getDefaultMonthlyTarget(
  allocation: IncomePlanAllocation,
  paychecksPerMonth: number,
): number {
  if (allocation.monthlyTarget !== null) {
    return allocation.monthlyTarget;
  }

  if (allocation.isRemainingBalance) {
    return 0;
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
      monthlyTarget: getDefaultMonthlyTarget(allocation, paychecksPerMonth),
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
