"use client";

import { useMemo } from "react";
import { PaycheckPlanDashboard } from "@/components/budgets/PaycheckPlanDashboard";
import { useCategoryBudgets } from "@/components/budgets/useCategoryBudgets";
import { IosBudgetsSection } from "@/components/native/ios/IosBudgetsSection";
import {
  IosCard,
  IosHeroMetric,
  IosScreen,
  IosSection,
  IosSkeletonScreen,
} from "@/components/native/ios/IosPrimitives";
import { useFinance } from "@/context/FinanceContext";
import { buildBudgetHubSummary } from "@/lib/budgets/budgetHub";
import { formatCurrency } from "@/lib/finance/format";
import { calculateMoneyLeftUntilPayday } from "@/lib/finance/moneyLeftUntilPayday";
import { cn } from "@/components/ui/cn";

/**
 * Native Budgets destination — paycheck plan first, then category limits.
 * Coordinates with iPhone polish (#114): Safe to Spend hero + compact metrics.
 */
export function IosBudgetsScreen() {
  const finance = useFinance();
  const budgets = useCategoryBudgets();
  const hub = useMemo(
    () => buildBudgetHubSummary(budgets.views, finance),
    [budgets.views, finance],
  );
  const moneyLeft = useMemo(
    () => calculateMoneyLeftUntilPayday(finance),
    [finance],
  );

  if (finance.isLoading && budgets.status === "loading") {
    return <IosSkeletonScreen rows={5} />;
  }

  return (
    <IosScreen>
      <IosCard padding="md">
        <IosHeroMetric
          label="Safe to Spend"
          value={formatCurrency(hub.safeToSpend)}
          hint="Cash-capped after bills and planned savings"
        />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Metric
            label="Until payday"
            value={formatCurrency(hub.safeUntilPayday)}
          />
          <Metric
            label="Budget remaining"
            value={formatCurrency(hub.totalRemainingBudgetAllowance)}
            hint="Category limits — not cash"
          />
          <Metric
            label="Daily allowance"
            value={formatCurrency(hub.dailySpendingAllowance)}
          />
          <Metric
            label="Left after commitments"
            value={formatCurrency(moneyLeft.moneyLeftAfterCommitments)}
            tone={
              moneyLeft.moneyLeftAfterCommitments < 0 ? "danger" : "default"
            }
          />
        </div>
      </IosCard>

      <IosSection title="Paycheck plan">
        <PaycheckPlanDashboard compact />
      </IosSection>

      <IosBudgetsSection />
    </IosScreen>
  );
}

function Metric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="ios-metric-chip min-w-0 overflow-hidden rounded-[14px] bg-white/[0.05] px-3 py-2.5">
      <span className="block truncate text-[11px] font-medium text-[var(--text-muted)]">
        {label}
      </span>
      <strong
        className={cn(
          "mt-0.5 block truncate text-[15px] font-semibold tabular-nums",
          tone === "danger" ? "text-[var(--danger)]" : "text-[var(--foreground)]",
        )}
      >
        {value}
      </strong>
      {hint ? (
        <span className="mt-0.5 block truncate text-[10px] text-[var(--text-muted)]">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
