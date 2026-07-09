"use client";

import Link from "next/link";
import { useMemo } from "react";
import { InfoTooltip } from "@/components/guidance/InfoTooltip";
import { StatCard } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency, formatMonthlyChange } from "@/lib/finance/format";
import {
  buildTransactionsHref,
  getCurrentMonthDateRange,
} from "@/lib/transactions/filterParams";

type DashboardMetric = {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  mutedChange?: boolean;
  tooltip?: string;
  href?: string;
};

export function DashboardHero() {
  const { dashboard } = useFinance();

  const metrics = useMemo<DashboardMetric[]>(() => {
    const netWorth = dashboard.kpiMetrics.find(
      (metric) => metric.label === "Net Worth",
    );
    const cash = dashboard.kpiMetrics.find((metric) => metric.label === "Cash");
    const safeToSpend = dashboard.moneyFlow.safeToSpend;
    const { dateFrom, dateTo } = getCurrentMonthDateRange();

    return [
      {
        label: "Net Worth",
        value: netWorth ? formatCurrency(netWorth.value) : "—",
        change: netWorth ? formatMonthlyChange(netWorth.monthlyChange) : "",
        positive: (netWorth?.monthlyChange ?? 0) >= 0,
        href: "/accounts",
      },
      {
        label: "Cash",
        value: cash ? formatCurrency(cash.value) : "—",
        change: cash ? formatMonthlyChange(cash.monthlyChange) : "",
        positive: (cash?.monthlyChange ?? 0) >= 0,
        href: "/accounts",
      },
      {
        label: "Safe To Spend",
        value: formatCurrency(safeToSpend),
        change: "After bills, goals & investments",
        positive: safeToSpend > 0,
        tooltip:
          "Monthly amount left after planned bills, debt payments, goals, and investments.",
        href: buildTransactionsHref({
          type: "expense",
          dateFrom,
          dateTo,
          filterLabel: "Recent spending",
        }),
      },
      {
        label: "Financial Health",
        value: String(dashboard.financialHealthScore.score),
        change: dashboard.financialHealthScore.metrics[0]?.label
          ? `${dashboard.financialHealthScore.metrics[0].label}: ${dashboard.financialHealthScore.metrics[0].value}`
          : "Your overall money health",
        positive: dashboard.financialHealthScore.score >= 60,
        tooltip: "Composite score from savings, debt, and emergency fund strength.",
        href: "/reports",
      },
    ];
  }, [dashboard]);

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4 xl:gap-6">
      {metrics.map((metric) => {
        const card = (
          <StatCard
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
        );

        if (metric.href) {
          return (
            <Link key={metric.label} href={metric.href} className="focus-ring block h-full">
              {card}
            </Link>
          );
        }

        return <div key={metric.label}>{card}</div>;
      })}
    </section>
  );
}
