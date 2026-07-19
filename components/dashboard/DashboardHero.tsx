"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { Sparkline } from "@/components/charts/Sparkline";
import { CHART_COLORS } from "@/components/charts/constants";
import { IconBadge, StatCard } from "@/components/ui";
import { dashboardKpiGridClassName } from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency, formatMonthlyChange } from "@/lib/finance/format";

type MetricIconName = "netWorth" | "cash" | "debt" | "savings" | "health";

function MetricIcon({ name }: { name: MetricIconName }) {
  const paths: Record<MetricIconName, ReactNode> = {
    netWorth: (
      <>
        <path d="M12 3v18" />
        <path d="M7 8l5-5 5 5" />
      </>
    ),
    cash: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10h18" />
      </>
    ),
    debt: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M7 12h4" />
      </>
    ),
    savings: (
      <>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    health: (
      <>
        <path d="M12 21s-6-4.35-6-10a4 4 0 0 1 7-2.6A4 4 0 0 1 18 11c0 5.65-6 10-6 10z" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}

export function DashboardHero() {
  const { dashboard, snapshot } = useFinance();

  const sparklines = useMemo(() => {
    const trends = snapshot.monthlyTrends;
    return {
      netWorth: trends.map((point) => point.income - point.spending),
      cash: trends.map((point) => point.income),
      debt: trends.map((point) => point.spending),
      savings: trends.map((point) => point.savings),
      health: trends.map((_, index) => dashboard.financialHealthScore.score - (5 - index)),
    };
  }, [dashboard.financialHealthScore.score, snapshot.monthlyTrends]);

  const metrics = useMemo(() => {
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
        icon: "netWorth" as const,
        tone: "accent" as const,
        sparkline: sparklines.netWorth,
        sparkColor: CHART_COLORS.primary,
      },
      {
        label: "Cash",
        value: cash ? formatCurrency(cash.value) : "—",
        change: cash ? formatMonthlyChange(cash.monthlyChange) : "",
        positive: (cash?.monthlyChange ?? 0) >= 0,
        icon: "cash" as const,
        tone: "success" as const,
        sparkline: sparklines.cash,
        sparkColor: CHART_COLORS.income,
      },
      {
        label: "Debt",
        value: debt ? formatCurrency(debt.value) : "—",
        change: debt ? formatMonthlyChange(debt.monthlyChange) : "",
        positive: (debt?.monthlyChange ?? 0) <= 0,
        mutedChange: !debt?.monthlyChange,
        icon: "debt" as const,
        tone: "danger" as const,
        sparkline: sparklines.debt,
        sparkColor: CHART_COLORS.debt,
      },
      {
        label: "Savings Rate",
        value: savingsRate?.value ?? "—",
        change: "",
        positive: savingsRate?.tone === "emerald",
        mutedChange: true,
        icon: "savings" as const,
        tone: "purple" as const,
        sparkline: sparklines.savings,
        sparkColor: CHART_COLORS.savings,
      },
      {
        label: "Financial Health",
        value: String(health.score),
        change: health.metrics[0]?.value ?? "",
        positive: health.score >= 60,
        mutedChange: true,
        icon: "health" as const,
        tone: "success" as const,
        sparkline: sparklines.health,
        sparkColor: CHART_COLORS.income,
      },
    ];
  }, [dashboard, sparklines]);

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
          icon={
            <IconBadge tone={metric.tone}>
              <MetricIcon name={metric.icon} />
            </IconBadge>
          }
          trailing={
            <Sparkline values={metric.sparkline} color={metric.sparkColor} />
          }
          className="h-full"
        />
      ))}
    </section>
  );
}
