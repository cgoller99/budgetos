"use client";

import { useMemo } from "react";
import { InfoTooltip } from "@/components/guidance/InfoTooltip";
import { StatCard } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency, formatMonthlyChange } from "@/lib/finance/format";

type DashboardMetric = {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  mutedChange?: boolean;
  tooltip?: string;
};

export function DashboardHero() {
  const { dashboard } = useFinance();

  const metrics = useMemo<DashboardMetric[]>(() => {
    const netWorth = dashboard.kpiMetrics.find(
      (metric) => metric.label === "Net Worth",
    );
    const cash = dashboard.kpiMetrics.find((metric) => metric.label === "Cash");
    const bills = dashboard.billsSummary;

    return [
      {
        label: "Net Worth",
        value: netWorth ? formatCurrency(netWorth.value) : "—",
        change: netWorth ? formatMonthlyChange(netWorth.monthlyChange) : "",
        positive: (netWorth?.monthlyChange ?? 0) >= 0,
      },
      {
        label: "Cash",
        value: cash ? formatCurrency(cash.value) : "—",
        change: cash ? formatMonthlyChange(cash.monthlyChange) : "",
        positive: (cash?.monthlyChange ?? 0) >= 0,
      },
      {
        label: "Safe to Spend",
        value: formatCurrency(bills.safeToSpendAfterUpcomingBills),
        change:
          bills.dueThisWeekCount > 0
            ? `${bills.dueThisWeekCount} bill${bills.dueThisWeekCount === 1 ? "" : "s"} due this week`
            : "After upcoming bills",
        positive: bills.safeToSpendAfterUpcomingBills > 0,
        tooltip:
          "What is left after upcoming bills, so you can spend with fewer surprises.",
      },
      {
        label: "Credit Score",
        value: "—",
        change: "Connect a bureau to track",
        positive: true,
        mutedChange: true,
      },
    ];
  }, [dashboard]);

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4 xl:gap-6">
      {metrics.map((metric) => (
        <StatCard
          key={metric.label}
          label={metric.label}
          value={metric.value}
          change={metric.change}
          positive={metric.positive}
          mutedChange={metric.mutedChange ?? false}
          tooltip={
            metric.tooltip ? <InfoTooltip label={metric.tooltip} /> : undefined
          }
          className="h-full"
        />
      ))}
    </section>
  );
}
