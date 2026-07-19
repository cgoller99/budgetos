"use client";

import { useMemo } from "react";
import { StatCard } from "@/components/ui";
import { dashboardKpiGridClassName } from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency, formatMonthlyChange } from "@/lib/finance/format";

type DashboardMetric = {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  mutedChange?: boolean;
};

export function DashboardHero() {
  const { dashboard } = useFinance();

  const metrics = useMemo<DashboardMetric[]>(() => {
    const netWorth = dashboard.kpiMetrics.find((m) => m.label === "Net Worth");
    const cash = dashboard.kpiMetrics.find((m) => m.label === "Cash");
    const debt = dashboard.kpiMetrics.find((m) => m.label === "Debt");
    const health = dashboard.financialHealthScore;
    const savingsRate = health.metrics.find((m) => m.label === "Savings rate");

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
        label: "Debt",
        value: debt ? formatCurrency(debt.value) : "—",
        change: debt ? formatMonthlyChange(debt.monthlyChange) : "",
        positive: (debt?.monthlyChange ?? 0) <= 0,
        mutedChange: !debt?.monthlyChange,
      },
      {
        label: "Savings Rate",
        value: savingsRate?.value ?? "—",
        change: "",
        positive: savingsRate?.tone === "emerald",
        mutedChange: true,
      },
      {
        label: "Financial Health",
        value: String(health.score),
        change: health.metrics[0]?.value ?? "",
        positive: health.score >= 60,
        mutedChange: true,
      },
    ];
  }, [dashboard]);

  return (
    <section className={dashboardKpiGridClassName}>
      {metrics.map((metric) => (
        <StatCard
          key={metric.label}
          label={metric.label}
          value={metric.value}
          change={metric.change}
          positive={metric.positive}
          mutedChange={metric.mutedChange ?? false}
          className="h-full"
        />
      ))}
    </section>
  );
}
