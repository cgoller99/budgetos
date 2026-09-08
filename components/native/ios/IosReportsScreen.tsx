"use client";

import { useMemo, useState } from "react";
import {
  IosCard,
  IosHeroMetric,
  IosList,
  IosListRow,
  IosProgressBar,
  IosScreen,
  IosSection,
  IosSkeletonScreen,
  IosTextButton,
} from "@/components/native/ios/IosPrimitives";
import { ProUpgradeBanner } from "@/components/subscription/ProUpgradeBanner";
import { NetWorthTimeline } from "@/components/dashboard/NetWorthTimeline";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";
import {
  downloadTransactionsCsv,
  getTrendMaxValue,
} from "@/lib/reports/reportMetrics";
import { buildTimeline } from "@/lib/timeline";
import { triggerHaptic } from "@/lib/native/haptics";
import { cn } from "@/components/ui/cn";

export function IosReportsScreen() {
  const finance = useFinance();
  const { snapshot, isLoading, dashboard } = finance;
  const [showCharts, setShowCharts] = useState(false);

  const topCategories = useMemo(
    () =>
      [...snapshot.categoryBreakdown]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 6),
    [snapshot.categoryBreakdown],
  );

  const trends = snapshot.monthlyTrends;
  const latestTrend = trends.at(-1) ?? null;
  const previousTrend = trends.length > 1 ? trends.at(-2) ?? null : null;
  const trendMax = getTrendMaxValue(trends);
  const hasTrendHistory = trends.some(
    (point) => point.income > 0 || point.spending > 0,
  );
  const netWorthTimeline = useMemo(
    () => buildTimeline(finance, "monthly"),
    [finance],
  );
  const hasNetWorthHistory = netWorthTimeline.length >= 2;

  if (isLoading) {
    return <IosSkeletonScreen rows={5} />;
  }

  const health = dashboard.financialHealthScore;
  const income = latestTrend?.income ?? 0;
  const spending = latestTrend?.spending ?? 0;
  const netCashFlow = income - spending;
  const prevNet = previousTrend
    ? previousTrend.income - previousTrend.spending
    : null;

  return (
    <IosScreen>
      <IosHeroMetric
        label="Financial Health"
        value={String(health.score)}
        hint="Score out of 100"
        tone={health.score >= 70 ? "positive" : health.score >= 40 ? "warning" : "danger"}
      />

      <div className="grid grid-cols-2 gap-3">
        <IosCard padding="md">
          <p className="text-[12px] font-medium text-[var(--text-muted)]">
            Income this month
          </p>
          <p className="mt-1 text-[18px] font-semibold tabular-nums text-[var(--success)]">
            {formatCurrency(income)}
          </p>
        </IosCard>
        <IosCard padding="md">
          <p className="text-[12px] font-medium text-[var(--text-muted)]">
            Spending this month
          </p>
          <p className="mt-1 text-[18px] font-semibold tabular-nums text-[var(--foreground)]">
            {formatCurrency(spending)}
          </p>
        </IosCard>
      </div>

      <IosCard padding="md">
        <p className="text-[12px] font-medium text-[var(--text-muted)]">Net cash flow</p>
        <p
          className={cn(
            "mt-1 text-[22px] font-semibold tabular-nums",
            netCashFlow >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]",
          )}
        >
          {netCashFlow >= 0 ? "+" : "−"}
          {formatCurrency(Math.abs(netCashFlow))}
        </p>
        <p className="mt-1 text-[12px] text-[var(--text-subtle)]">
          {prevNet === null
            ? "Income minus spending this month"
            : `vs ${prevNet >= 0 ? "+" : "−"}${formatCurrency(Math.abs(prevNet))} last month`}
        </p>
      </IosCard>

      <ProUpgradeBanner requiredPlan="pro_plus" featureLabel="Advanced reports" />

      <IosSection
        title="Top spending categories"
        action={
          <IosTextButton
            onClick={() => {
              void triggerHaptic("light");
              downloadTransactionsCsv(finance);
            }}
          >
            Export
          </IosTextButton>
        }
      >
        {topCategories.length === 0 ? (
          <IosCard padding="md">
            <p className="text-[15px] font-semibold text-[var(--foreground)]">
              No spending breakdown yet
            </p>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">
              Categories appear after expenses sync from your accounts.
            </p>
          </IosCard>
        ) : (
          <IosList>
            {topCategories.map((category) => (
              <IosListRow
                key={category.category}
                title={category.category}
                subtitle={`${Math.round(category.percent ?? 0)}% of spending`}
                trailing={formatCurrency(category.amount)}
              />
            ))}
          </IosList>
        )}
      </IosSection>

      {topCategories.length > 0 ? (
        <IosSection title="Spending breakdown">
          <IosCard padding="md" className="space-y-3">
            {topCategories.slice(0, 4).map((category) => (
              <div key={`bar-${category.category}`}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="truncate text-[13px] text-[var(--foreground)]">
                    {category.category}
                  </p>
                  <p className="text-[12px] tabular-nums text-[var(--text-muted)]">
                    {formatCurrency(category.amount)}
                  </p>
                </div>
                <IosProgressBar value={category.percent ?? 0} />
              </div>
            ))}
          </IosCard>
        </IosSection>
      ) : null}

      <IosSection title="Monthly trend">
        {!hasTrendHistory ? (
          <IosCard padding="md">
            <p className="text-[15px] font-semibold text-[var(--foreground)]">
              Not enough history yet
            </p>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">
              Trends unlock after a month of income and spending activity.
            </p>
          </IosCard>
        ) : (
          <IosCard padding="md">
            <div className="flex h-28 items-end gap-1.5">
              {trends.map((point) => {
                const incomeHeight = Math.max(8, (point.income / trendMax) * 100);
                const spendHeight = Math.max(8, (point.spending / trendMax) * 100);
                return (
                  <div key={point.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <div className="flex h-20 w-full items-end justify-center gap-0.5">
                      <span
                        className="w-[42%] rounded-t-[3px] bg-[var(--success)]/80"
                        style={{ height: `${incomeHeight}%` }}
                        title={`Income ${formatCurrency(point.income)}`}
                      />
                      <span
                        className="w-[42%] rounded-t-[3px] bg-[var(--accent)]/70"
                        style={{ height: `${spendHeight}%` }}
                        title={`Spending ${formatCurrency(point.spending)}`}
                      />
                    </div>
                    <p className="text-[10px] text-[var(--text-subtle)]">{point.label}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-[var(--success)]/80" /> Income
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-[var(--accent)]/70" /> Spending
              </span>
            </div>
          </IosCard>
        )}
      </IosSection>

      <IosSection title="Income vs spending">
        <div className="grid grid-cols-2 gap-3">
          <IosCard padding="md">
            <p className="text-[12px] text-[var(--text-muted)]">Income</p>
            <p className="mt-1 text-[16px] font-semibold tabular-nums text-[var(--success)]">
              {formatCurrency(income)}
            </p>
          </IosCard>
          <IosCard padding="md">
            <p className="text-[12px] text-[var(--text-muted)]">Spending</p>
            <p className="mt-1 text-[16px] font-semibold tabular-nums text-[var(--foreground)]">
              {formatCurrency(spending)}
            </p>
          </IosCard>
        </div>
      </IosSection>

      <IosSection
        title="Net worth trend"
        action={
          hasNetWorthHistory ? (
            <IosTextButton
              onClick={() => {
                void triggerHaptic("selection");
                setShowCharts((current) => !current);
              }}
            >
              {showCharts ? "Hide" : "Details"}
            </IosTextButton>
          ) : undefined
        }
      >
        {!hasNetWorthHistory ? (
          <IosCard padding="md">
            <p className="text-[15px] font-semibold text-[var(--foreground)]">
              Net worth history unavailable
            </p>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">
              Keep accounts connected and we’ll chart changes over time.
            </p>
          </IosCard>
        ) : showCharts ? (
          <div className="ios-embedded-panel space-y-3 [&_.rounded-3xl]:rounded-[16px]">
            <NetWorthTimeline />
          </div>
        ) : (
          <IosCard padding="md">
            <p className="text-[13px] text-[var(--text-muted)]">
              Tap Details for the full net worth timeline.
            </p>
          </IosCard>
        )}
      </IosSection>

      <IosCard padding="md" className={cn(health.score >= 70 && "border-[var(--success)]/20")}>
        <p className="text-[14px] font-semibold text-[var(--foreground)]">Insights</p>
        <ul className="mt-2 space-y-1.5">
          {(health.reasons.length > 0 ? health.reasons : ["Keep tracking to unlock insights."])
            .slice(0, 3)
            .map((reason) => (
              <li key={reason} className="text-[13px] text-[var(--text-secondary)]">
                {reason}
              </li>
            ))}
        </ul>
      </IosCard>
    </IosScreen>
  );
}
