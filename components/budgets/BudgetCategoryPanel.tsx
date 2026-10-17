"use client";

import { useMemo, useState } from "react";
import { BudgetScheduleFields } from "@/components/budgets/BudgetScheduleFields";
import { Button, Input, ProgressBar } from "@/components/ui";
import { MobileCollapsibleSection } from "@/components/ui/MobileCollapsibleSection";
import {
  buildBudgetHealth,
  listBudgetCategoryTransactions,
  topMerchantsForBudget,
  unusualBudgetSpend,
} from "@/lib/budgets/budgetAnalytics";
import { budgetLimitLabel } from "@/lib/budgets/budgetPeriod";
import type { CategoryBudgetView } from "@/lib/budgets/categoryBudgets";
import type { BudgetSchedule } from "@/lib/budgets/budgetPeriod";
import { formatCurrency } from "@/lib/finance/format";
import { useFinance } from "@/context/FinanceContext";

type BudgetCategoryPanelProps = {
  view: CategoryBudgetView;
  onUpdateBudget: (
    category: string,
    patch: Partial<BudgetSchedule> & { amount?: number },
  ) => void;
  onUpdateAmount: (category: string, amount: number) => void;
  onRemove: (category: string) => void;
  onSetRollover: (category: string, enabled: boolean) => void;
};

export function BudgetCategoryPanel({
  view,
  onUpdateBudget,
  onUpdateAmount,
  onRemove,
  onSetRollover,
}: BudgetCategoryPanelProps) {
  const finance = useFinance();
  const [showTx, setShowTx] = useState(false);
  const merchants = useMemo(
    () => topMerchantsForBudget(finance, view),
    [finance, view],
  );
  const transactions = useMemo(
    () => (showTx ? listBudgetCategoryTransactions(finance, view) : []),
    [finance, showTx, view],
  );
  const unusual = unusualBudgetSpend(view);
  const paceLabel =
    view.paceRatio == null
      ? "No pace yet"
      : view.paceRatio >= 1.15
        ? "Ahead of pace"
        : view.paceRatio <= 0.85
          ? "Under pace"
          : "On pace";

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--surface-border)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">{view.category}</p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {view.frequencyLabel} · {view.periodLabel}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {formatCurrency(view.effectiveLimit)} limit
            {view.rolloverCredit > 0
              ? ` (incl. ${formatCurrency(view.rolloverCredit)} rolled allowance)`
              : ""}{" "}
            · {formatCurrency(view.spent)} spent ·{" "}
            {view.overspent
              ? `${formatCurrency(Math.abs(view.remaining))} over`
              : `${formatCurrency(view.remaining)} left`}
          </p>
          {view.frequency === "monthly" ? null : (
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              About {formatCurrency(view.monthlyEquivalent)} in a typical month.
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="text"
          size="sm"
          className="text-[var(--danger)]"
          onClick={() => onRemove(view.category)}
        >
          Remove
        </Button>
      </div>

      <ProgressBar
        value={view.progress}
        variant={view.overspent ? "danger" : "primary"}
        className="mt-3"
      />
      {view.alert ? (
        <p className="mt-2 text-xs font-medium text-[var(--danger)]">{view.alert}</p>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--text-muted)] sm:grid-cols-4">
        <Metric label="Days left" value={String(view.daysRemaining)} />
        <Metric label="Avg daily" value={formatCurrency(view.averageDailySpent)} />
        <Metric
          label="Suggested daily"
          value={formatCurrency(view.recommendedDailyRemaining)}
        />
        <Metric label="Pace" value={paceLabel} />
        <Metric
          label="Projected spend"
          value={formatCurrency(view.projectedEndOfPeriodSpent)}
        />
        <Metric
          label={view.estimatedOverageOrSurplus >= 0 ? "Est. surplus" : "Est. overage"}
          value={formatCurrency(Math.abs(view.estimatedOverageOrSurplus))}
        />
        <Metric
          label="Prior period"
          value={formatCurrency(view.previousPeriodSpent)}
        />
        <Metric label="Used" value={`${view.progress}%`} />
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <input
          type="checkbox"
          checked={view.rolloverEnabled}
          onChange={(event) => onSetRollover(view.category, event.target.checked)}
        />
        Roll unused prior allowance into this period (not cash)
      </label>

      <div className="mt-3">
        <BudgetScheduleFields
          tone="web"
          idPrefix={`budget-${view.category}`}
          value={view}
          onChange={(patch) => onUpdateBudget(view.category, patch)}
        />
      </div>
      <label className="mt-3 block text-xs text-[var(--text-muted)]">
        {budgetLimitLabel(view.frequency)}
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={view.limit}
          aria-label={`${view.category} budget`}
          className="mt-1"
          onChange={(event) => {
            onUpdateAmount(view.category, Number.parseFloat(event.target.value));
          }}
        />
      </label>

      <MobileCollapsibleSection
        title="Analytics & transactions"
        description="Merchants, prior period, and included spending"
        className="mt-4"
      >
        {unusual ? (
          <p className="mb-3 text-xs font-medium text-[var(--warning,var(--danger))]">
            {unusual}
          </p>
        ) : null}
        {merchants.length > 0 ? (
          <div className="mb-3">
            <p className="text-xs font-semibold text-[var(--foreground)]">
              Top merchants this period
            </p>
            <ul className="mt-2 space-y-1">
              {merchants.map((item) => (
                <li
                  key={item.merchant}
                  className="flex justify-between gap-2 text-xs text-[var(--text-muted)]"
                >
                  <span className="truncate">
                    {item.merchant} · {item.count}×
                  </span>
                  <span className="tabular-nums">{formatCurrency(item.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mb-3 text-xs text-[var(--text-muted)]">
            No spending in this period yet.
          </p>
        )}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setShowTx((value) => !value)}
        >
          {showTx ? "Hide transactions" : "Show transactions in this budget"}
        </Button>
        {showTx ? (
          <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
            {transactions.length === 0 ? (
              <li className="text-xs text-[var(--text-muted)]">No transactions.</li>
            ) : (
              transactions.map((transaction) => (
                <li
                  key={transaction.id}
                  className="flex justify-between gap-2 text-xs text-[var(--text-muted)]"
                >
                  <span className="truncate">
                    {transaction.date} · {transaction.merchant}
                  </span>
                  <span className="tabular-nums">
                    {formatCurrency(transaction.amount)}
                  </span>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </MobileCollapsibleSection>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--surface-border)] px-2 py-1.5">
      <p>{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-[var(--foreground)]">{value}</p>
    </div>
  );
}

export function BudgetHealthSummary({ views }: { views: CategoryBudgetView[] }) {
  const health = buildBudgetHealth(views);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="On track" value={String(health.onTrackCount)} />
      <Stat label="Approaching" value={String(health.approachingCount)} />
      <Stat label="Overspent" value={String(health.overspentCount)} />
      <Stat
        label="Fixed / flexible"
        value={`${formatCurrency(health.fixedMonthlyEquivalent)} / ${formatCurrency(health.flexibleMonthlyEquivalent)}`}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-3 py-2.5">
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}
