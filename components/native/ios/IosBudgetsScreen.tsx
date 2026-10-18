"use client";

import { useMemo } from "react";
import { PaycheckPlanDashboard } from "@/components/budgets/PaycheckPlanDashboard";
import { useCategoryBudgets } from "@/components/budgets/useCategoryBudgets";
import { IosBudgetsSection } from "@/components/native/ios/IosBudgetsSection";
import {
  IosCard,
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
 * Native Budgets — Ongoing Budget first (matches web section order).
 * Coordinates with iPhone polish (#114).
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
      <IosSection title="Budgets">
        <PaycheckPlanDashboard compact />
      </IosSection>

      <IosSection title="Spending & bills">
        <IosCard padding="md">
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Safe to Spend" value={formatCurrency(hub.safeToSpend)} />
            <Metric
              label="Until payday"
              value={formatCurrency(hub.safeUntilPayday)}
            />
            <Metric
              label="Budget remaining"
              value={formatCurrency(hub.totalRemainingBudgetAllowance)}
              hint="Limits — not cash"
            />
            <Metric
              label="After commitments"
              value={formatCurrency(moneyLeft.moneyLeftAfterCommitments)}
              tone={
                moneyLeft.moneyLeftAfterCommitments < 0 ? "danger" : "default"
              }
            />
          </div>
        </IosCard>
        <div className="mt-3">
          <IosBudgetsSection />
        </div>
      </IosSection>
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
