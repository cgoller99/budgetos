"use client";

import { useMemo } from "react";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency, formatMonthlyChange } from "@/lib/finance/format";
import { cn } from "@/components/ui/cn";
import { metricLabelClassName, metricValueClassName } from "@/components/ui/tokens";

const WEEKS_PER_MONTH = 4.33;

export function DashboardHero() {
  const { dashboard } = useFinance();

  const hero = useMemo(() => {
    const netWorth = dashboard.kpiMetrics.find(
      (metric) => metric.label === "Net Worth",
    );
    const weeklySafeToSpend = Math.round(
      dashboard.moneyFlow.safeToSpend / WEEKS_PER_MONTH,
    );
    const health = dashboard.financialHealthScore;
    const bills = dashboard.billsSummary;
    const debts = dashboard.debtsSummary;

    return {
      netWorth: netWorth ? formatCurrency(netWorth.value) : "—",
      netWorthChange: netWorth ? formatMonthlyChange(netWorth.monthlyChange) : "",
      netWorthPositive: (netWorth?.monthlyChange ?? 0) >= 0,
      safeToSpend: formatCurrency(weeklySafeToSpend),
      healthScore: health.score,
      billsDue:
        bills.dueThisWeekCount > 0
          ? `${bills.dueThisWeekCount} due · ${formatCurrency(bills.dueThisWeekAmount)}`
          : "No bills due this week",
      debtSummary:
        debts.activeDebtCount > 0
          ? `${formatCurrency(debts.totalDebt)} debt · ${Math.round(debts.debtFreeProgress)}% paid off`
          : "No active debt",
    };
  }, [dashboard]);

  return (
    <section className="space-y-10">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className={metricLabelClassName}>Net worth</p>
          <p className={cn("mt-4", metricValueClassName)}>{hero.netWorth}</p>
          {hero.netWorthChange && (
            <p
              className={cn(
                "mt-4 text-base tabular-nums",
                hero.netWorthPositive
                  ? "text-emerald-400/90"
                  : "text-rose-400/90",
              )}
            >
              {hero.netWorthChange}
            </p>
          )}
        </div>

        <div>
          <p className={metricLabelClassName}>Safe to spend this week</p>
          <p className={cn("mt-4", metricValueClassName)}>{hero.safeToSpend}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-base text-white/40">
        <span>
          Health{" "}
          <span className="font-medium tabular-nums text-white/70">
            {hero.healthScore}
          </span>
        </span>
        <span className="hidden h-1 w-1 rounded-full bg-white/20 sm:inline-block" />
        <span>{hero.billsDue}</span>
        <span className="hidden h-1 w-1 rounded-full bg-white/20 sm:inline-block" />
        <span>{hero.debtSummary}</span>
      </div>
    </section>
  );
}
