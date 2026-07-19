"use client";

import { useMemo } from "react";
import { DonutChart } from "@/components/charts/DonutChart";
import { ExpandableCard, PanelLink } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";

export function SpendingBreakdownCard() {
  const { snapshot } = useFinance();
  const segments = snapshot.categoryBreakdown.map((item) => ({
    label: item.category,
    value: item.amount,
    percent: item.percent,
  }));

  const totalSpending = useMemo(
    () => segments.reduce((sum, item) => sum + item.value, 0),
    [segments],
  );
  const topCategory = segments[0];

  return (
    <ExpandableCard
      title="Spending Breakdown"
      headerAction={<PanelLink href="/reports">Reports</PanelLink>}
      summary={
        <div className="flex items-center gap-3">
          <DonutChart segments={segments} compact />
          <div className="min-w-0">
            <p className="text-lg font-semibold tabular-nums text-[var(--foreground)]">
              {formatCurrency(totalSpending)}
            </p>
            <p className="truncate text-xs text-[var(--text-muted)]">
              {topCategory
                ? `${topCategory.label} · ${Math.round(topCategory.percent)}%`
                : "No spending yet"}
            </p>
          </div>
        </div>
      }
      insights={
        topCategory ? (
          <p className="text-xs text-[var(--text-muted)]">
            Top category{" "}
            <span className="font-medium text-[var(--text-secondary)]">
              {topCategory.label}
            </span>{" "}
            accounts for {Math.round(topCategory.percent)}% of tracked spending.
          </p>
        ) : null
      }
    >
      <DonutChart segments={segments} maxLegendItems={8} />
    </ExpandableCard>
  );
}
