"use client";

import { useMemo } from "react";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency, formatMonthlyChange } from "@/lib/finance/format";
import { cn } from "@/components/ui/cn";
import { metricLabelClassName, metricValueClassName } from "@/components/ui/tokens";

export function DashboardHero() {
  const { dashboard } = useFinance();

  const hero = useMemo(() => {
    const netWorth = dashboard.kpiMetrics.find(
      (metric) => metric.label === "Net Worth",
    );
    const health = dashboard.financialHealthScore;
    const bills = dashboard.billsSummary;
    const debts = dashboard.debtsSummary;
    const nextPaycheck = dashboard.nextPaycheck;
    const nextBill = bills.nextBill;

    return {
      netWorth: netWorth ? formatCurrency(netWorth.value) : "—",
      netWorthChange: netWorth ? formatMonthlyChange(netWorth.monthlyChange) : "",
      netWorthPositive: (netWorth?.monthlyChange ?? 0) >= 0,
      safeToSpend: formatCurrency(bills.safeToSpendAfterUpcomingBills),
      healthScore: health.score,
      nextPaycheck: nextPaycheck
        ? `${nextPaycheck.name} · ${formatCurrency(nextPaycheck.amount)} · ${nextPaycheck.formattedDate}`
        : "No upcoming paycheck",
      nextBill: nextBill
        ? `${nextBill.name} · ${formatCurrency(nextBill.amount)} · ${nextBill.dueDate}`
        : "No upcoming bills",
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
      <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
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
          <p className={metricLabelClassName}>Next paycheck</p>
          <p className="mt-4 text-lg font-medium tracking-tight text-white/90">
            {hero.nextPaycheck}
          </p>
        </div>

        <div>
          <p className={metricLabelClassName}>Next bill</p>
          <p className="mt-4 text-lg font-medium tracking-tight text-white/90">
            {hero.nextBill}
          </p>
        </div>

        <div>
          <p className={metricLabelClassName}>Safe to spend after bills</p>
          <p className={cn("mt-4", metricValueClassName)}>{hero.safeToSpend}</p>
          <p className="mt-3 text-sm text-white/38">{hero.billsDue}</p>
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
        <span>{hero.debtSummary}</span>
      </div>
    </section>
  );
}
