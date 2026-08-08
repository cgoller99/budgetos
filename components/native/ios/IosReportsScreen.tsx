"use client";

import { useMemo, useState } from "react";
import {
  IosCard,
  IosHeroMetric,
  IosList,
  IosListRow,
  IosScreen,
  IosSection,
  IosSkeletonScreen,
  IosTextButton,
} from "@/components/native/ios/IosPrimitives";
import { ProUpgradeBanner } from "@/components/subscription/ProUpgradeBanner";
import { NetWorthTimeline } from "@/components/dashboard/NetWorthTimeline";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";
import { downloadTransactionsCsv } from "@/lib/reports/reportMetrics";
import { triggerHaptic } from "@/lib/native/haptics";
import { cn } from "@/components/ui/cn";

export function IosReportsScreen() {
  const finance = useFinance();
  const { snapshot, isLoading } = finance;
  const [showCharts, setShowCharts] = useState(false);

  const topCategories = useMemo(
    () =>
      [...snapshot.categoryBreakdown]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
    [snapshot.categoryBreakdown],
  );

  const latestTrend = snapshot.monthlyTrends.at(-1) ?? null;

  if (isLoading) {
    return <IosSkeletonScreen rows={5} />;
  }

  const health = finance.dashboard.financialHealthScore;

  return (
    <IosScreen>
      <IosHeroMetric
        label="Financial health"
        value={String(health.score)}
        hint="Score out of 100"
        tone={health.score >= 70 ? "positive" : health.score >= 40 ? "warning" : "danger"}
      />

      <div className="grid grid-cols-2 gap-3">
        <IosCard padding="md">
          <p className="text-[12px] font-medium text-[var(--text-muted)]">Income</p>
          <p className="mt-1 text-[18px] font-semibold tabular-nums text-[var(--success)]">
            {formatCurrency(latestTrend?.income ?? 0)}
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-subtle)]">Latest month</p>
        </IosCard>
        <IosCard padding="md">
          <p className="text-[12px] font-medium text-[var(--text-muted)]">Spending</p>
          <p className="mt-1 text-[18px] font-semibold tabular-nums text-[var(--foreground)]">
            {formatCurrency(latestTrend?.spending ?? 0)}
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-subtle)]">Latest month</p>
        </IosCard>
      </div>

      <ProUpgradeBanner requiredPlan="pro_plus" featureLabel="Advanced reports" />

      <IosSection
        title="Top categories"
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
            <p className="text-[13px] text-[var(--text-muted)]">
              Spend across categories to unlock breakdowns.
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

      <IosSection
        title="Charts"
        action={
          <IosTextButton
            onClick={() => {
              void triggerHaptic("selection");
              setShowCharts((current) => !current);
            }}
          >
            {showCharts ? "Hide" : "View Details"}
          </IosTextButton>
        }
      >
        {showCharts ? (
          <div className="ios-embedded-panel space-y-3 [&_.rounded-3xl]:rounded-[16px]">
            <NetWorthTimeline />
          </div>
        ) : (
          <IosCard padding="md">
            <p className="text-[13px] text-[var(--text-muted)]">
              Net worth timeline and deeper trends stay behind View Details.
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
