"use client";

import { useMemo } from "react";
import { BarTrendChart } from "@/components/charts/BarTrendChart";
import { CHART_COLORS } from "@/components/charts/constants";
import { ExpandableCard, PanelLink } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";

export function FinancialTrendsCard() {
  const { snapshot } = useFinance();

  const spendingPoints = useMemo(
    () =>
      snapshot.monthlyTrends.map((point) => ({
        key: point.key,
        label: point.label,
        value: point.spending,
      })),
    [snapshot.monthlyTrends],
  );

  const incomePoints = useMemo(
    () =>
      snapshot.monthlyTrends.map((point) => ({
        key: point.key,
        label: point.label,
        value: point.income,
      })),
    [snapshot.monthlyTrends],
  );

  const latestSpending = spendingPoints.at(-1)?.value ?? 0;
  const previousSpending = spendingPoints.at(-2)?.value ?? 0;
  const spendingDelta = latestSpending - previousSpending;

  return (
    <ExpandableCard
      title="Financial Trends"
      headerAction={<PanelLink href="/reports">Reports</PanelLink>}
      summary={
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-lg font-semibold tabular-nums text-[var(--foreground)]">
              {formatCurrency(latestSpending)}
            </p>
            <p
              className={`text-xs tabular-nums ${
                spendingDelta <= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
              }`}
            >
              {spendingDelta >= 0 ? "+" : ""}
              {formatCurrency(spendingDelta)} vs prior
            </p>
          </div>
          <BarTrendChart
            points={spendingPoints}
            color={CHART_COLORS.spending}
            compact
            emptyMessage="Spending trends appear as you add transactions."
          />
        </div>
      }
      insights={
        <p className="text-xs text-[var(--text-muted)]">
          Six-month view of spending and income activity from your ledger.
        </p>
      }
    >
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Spending
          </p>
          <BarTrendChart
            points={spendingPoints}
            color={CHART_COLORS.spending}
            emptyMessage="Spending trends appear as you add transactions."
          />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Income
          </p>
          <BarTrendChart
            points={incomePoints}
            color={CHART_COLORS.income}
            emptyMessage="Income trends appear as you add transactions."
          />
        </div>
      </div>
    </ExpandableCard>
  );
}
