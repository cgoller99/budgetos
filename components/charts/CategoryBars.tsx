"use client";

import { ProgressBar } from "@/components/ui";
import { formatCurrency } from "@/lib/finance/format";
import { cn } from "@/components/ui/cn";

export type CategoryBarItem = {
  label: string;
  amount: number;
  percent: number;
};

type CategoryBarsProps = {
  items: CategoryBarItem[];
  emptyMessage?: string;
  className?: string;
  maxItems?: number;
};

export function CategoryBars({
  items,
  emptyMessage = "No spending data yet",
  className,
  maxItems = 5,
}: CategoryBarsProps) {
  const visibleItems = items.slice(0, maxItems);

  if (visibleItems.length === 0) {
    return (
      <p className={cn("py-6 text-center text-sm text-[var(--text-muted)]", className)}>
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className={cn("space-y-4", className)}>
      {visibleItems.map((item) => (
        <li key={item.label}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium text-[var(--foreground)]">
              {item.label}
            </span>
            <span className="shrink-0 tabular-nums text-[var(--text-muted)]">
              {formatCurrency(item.amount)}
            </span>
          </div>
          <ProgressBar value={item.percent} />
        </li>
      ))}
    </ul>
  );
}
