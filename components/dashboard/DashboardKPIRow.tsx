"use client";

import { useMemo } from "react";
import { StatCard } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency, formatMonthlyChange } from "@/lib/finance/format";

export function DashboardKPIRow() {
  const { dashboard } = useFinance();

  const metrics = useMemo(() => {
    const netWorth = dashboard.kpiMetrics.find(
      (metric) => metric.label === "Net Worth",
    );
    const safeToSpend = dashboard.moneyFlow.safeToSpend;
    const health = dashboard.financialHealthScore;
    const bills = dashboard.billsSummary;

    return [
      {
        label: "Net Worth",
        value: netWorth ? formatCurrency(netWorth.value) : "—",
        change: netWorth ? formatMonthlyChange(netWorth.monthlyChange) : "",
        positive: (netWorth?.monthlyChange ?? 0) >= 0,
      },
      {
        label: "Safe To Spend",
        value: formatCurrency(safeToSpend),
        change: "After bills, goals & investments",
        positive: safeToSpend > 0,
      },
      {
        label: "Financial Health Score",
        value: String(health.score),
        change: health.metrics[0]
          ? `${health.metrics[0].label}: ${health.metrics[0].value}`
          : "Overall financial wellness",
        positive: health.score >= 60,
      },
      {
        label: "Bills Due Soon",
        value:
          bills.dueThisWeekCount > 0
            ? formatCurrency(bills.dueThisWeekAmount)
            : "None",
        change:
          bills.dueThisWeekCount > 0
            ? `${bills.dueThisWeekCount} bill${bills.dueThisWeekCount === 1 ? "" : "s"} this week`
            : "You're all caught up",
        positive: bills.dueThisWeekCount === 0,
      },
    ];
  }, [dashboard]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <StatCard
          key={metric.label}
          label={metric.label}
          value={metric.value}
          change={metric.change}
          positive={metric.positive}
        />
      ))}
    </div>
  );
}
