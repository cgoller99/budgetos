import { getAllocationSummary } from "@/lib/incomePlan/allocations";
import type { IncomePlanAllocation } from "@/lib/incomePlan/types";
import { formatCurrency } from "@/lib/finance/format";
import { cn } from "@/components/ui/cn";

type AllocationSummaryProps = {
  paycheckAmount: number;
  allocations: Pick<IncomePlanAllocation, "amount" | "isRemainingBalance">[];
  className?: string;
};

export function AllocationSummary({
  paycheckAmount,
  allocations,
  className,
}: AllocationSummaryProps) {
  const summary = getAllocationSummary(paycheckAmount, allocations);

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--surface-border)] bg-[var(--background)] p-4 sm:p-5",
        className,
      )}
    >
      <dl className="grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Paycheck amount
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-[var(--foreground)]">
            {formatCurrency(summary.paycheckAmount)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Fixed allocated amount
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-[var(--foreground)]">
            {formatCurrency(summary.fixedAllocated)}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Remaining amount
          </dt>
          <dd
            className={cn(
              "mt-1 text-lg font-semibold tabular-nums",
              summary.isOverAllocated
                ? "text-red-500"
                : "text-[var(--foreground)]",
            )}
          >
            {formatCurrency(summary.remaining)}
          </dd>
        </div>
      </dl>

      {summary.isOverAllocated && (
        <p className="mt-4 text-sm font-medium text-red-500">
          Your allocations exceed this paycheck by {formatCurrency(summary.overBy)}.
        </p>
      )}
    </div>
  );
}
