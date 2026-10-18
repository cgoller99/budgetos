"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { AllocationEditSheet } from "@/components/budgets/AllocationEditSheet";
import { Button, Card, CardContent, CardHeader } from "@/components/ui";
import { MobileCollapsibleSection } from "@/components/ui/MobileCollapsibleSection";
import { cn } from "@/components/ui/cn";
import { useFinance } from "@/context/FinanceContext";
import {
  FORECAST_HORIZONS,
  buildAccountForecasts,
  type ForecastHorizonId,
} from "@/lib/budgets/accountForecast";
import {
  formatBalanceFreshness,
  formatBankAccountShort,
} from "@/lib/budgets/accountDisplay";
import { buildPaycheckBreakdown } from "@/lib/budgets/paycheckBreakdown";
import { formatCurrency } from "@/lib/finance/format";
import { filterPersonalIncomePlan } from "@/lib/finance/personalIncomeScope";
import { INCOME_PLAN_SCHEDULE_LABELS } from "@/lib/incomePlan/types";
import { triggerHaptic } from "@/lib/native/haptics";

type PaycheckPlanDashboardProps = {
  compact?: boolean;
};

export function PaycheckPlanDashboard({ compact = false }: PaycheckPlanDashboardProps) {
  const finance = useFinance();
  const [horizonId, setHorizonId] = useState<ForecastHorizonId>("3m");
  const [editTarget, setEditTarget] = useState<{ allocationId: string } | null>(null);
  const [editAll, setEditAll] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const breakdown = useMemo(() => buildPaycheckBreakdown(finance), [finance]);
  const plan = useMemo(
    () => filterPersonalIncomePlan(finance.incomePlan, finance.viewerUserId ?? null),
    [finance.incomePlan, finance.viewerUserId],
  );
  const forecasts = useMemo(() => buildAccountForecasts(finance), [finance]);
  const accountsById = useMemo(
    () => new Map(finance.accounts.map((account) => [account.id, account])),
    [finance.accounts],
  );

  const horizon =
    FORECAST_HORIZONS.find((item) => item.id === horizonId) ?? FORECAST_HORIZONS[1];

  function openEdit(allocationId: string) {
    void triggerHaptic("selection");
    setEditAll(false);
    setEditTarget({ allocationId });
  }

  function openEditBudget() {
    void triggerHaptic("selection");
    setEditTarget(null);
    setEditAll(true);
  }

  function closeEditor() {
    setEditTarget(null);
    setEditAll(false);
  }

  if (!breakdown.hasPlan) {
    return (
      <>
        <Card className={cn(compact && "border-white/[0.05]")}>
          <CardHeader
            title="1. My Budget"
            description="No paycheck budget yet. Safe to Spend still works from cash and bills."
          />
          <CardContent className="space-y-3">
            <p className="text-sm text-[var(--text-muted)]">
              Set up your Income Plan once — then you can change amounts and bank accounts
              here anytime.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/income?tab=plan"
                className="inline-flex min-h-11 items-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white"
              >
                Set up My Budget
              </Link>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. My Budget */}
      <Card className={cn(compact && "border-white/[0.05]")}>
        <CardHeader
          title="1. My Budget"
          description={
            plan
              ? `${INCOME_PLAN_SCHEDULE_LABELS[plan.paySchedule]} income`
              : "Your paycheck plan"
          }
          action={
            <Button
              type="button"
              size="sm"
              className="min-h-11"
              onClick={openEditBudget}
            >
              Edit Budget
            </Button>
          }
        />
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric label="Income" value={formatCurrency(breakdown.paycheckAmount)} />
            <Metric label="Allocated" value={formatCurrency(breakdown.totalAllocated)} />
            <Metric
              label="Money Left"
              value={formatCurrency(breakdown.unallocated)}
            />
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Tap any item below to change its amount or bank account. Planning only — money
            does not move automatically.
          </p>
        </CardContent>
      </Card>

      {/* 2. Where My Money Goes */}
      <Card className={cn(compact && "border-white/[0.05]")}>
        <CardHeader
          title="2. Where My Money Goes"
          description="Each slice of your paycheck"
        />
        <CardContent className="space-y-2">
          {breakdown.rows.map((row) => {
            const account = row.accountId ? accountsById.get(row.accountId) : null;
            const bankLabel = account
              ? formatBankAccountShort(account)
              : "No bank account linked";
            const showDetails = detailsId === row.allocationId;
            return (
              <div
                key={row.allocationId}
                className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)]"
              >
                <button
                  type="button"
                  className="flex min-h-11 w-full items-start gap-3 px-3 py-3 text-left"
                  onClick={() => openEdit(row.allocationId)}
                  aria-label={`Edit ${row.name}`}
                >
                  <span className="mt-0.5 text-lg" aria-hidden>
                    {row.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold text-[var(--foreground)]">
                        {row.name}
                      </span>
                      <span className="shrink-0 tabular-nums font-semibold text-[var(--foreground)]">
                        {formatCurrency(row.amountPerPaycheck)}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-[var(--text-muted)]">
                      Bank account: {bankLabel}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
                      {row.percentOfPaycheck}% of paycheck
                      {row.goalName ? ` · Goal: ${row.goalName}` : ""}
                    </span>
                  </span>
                </button>
                <div className="flex border-t border-[var(--surface-border)]">
                  <button
                    type="button"
                    className="min-h-11 flex-1 px-3 text-left text-xs font-medium text-[var(--accent-light)]"
                    onClick={() => openEdit(row.allocationId)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="min-h-11 flex-1 px-3 text-left text-xs font-medium text-[var(--text-muted)]"
                    onClick={() =>
                      setDetailsId(showDetails ? null : row.allocationId)
                    }
                  >
                    {showDetails ? "Hide details" : "Details"}
                  </button>
                </div>
                {showDetails ? (
                  <div className="grid grid-cols-2 gap-2 border-t border-[var(--surface-border)] px-3 py-3 text-sm">
                    <Detail label="Per week" value={formatCurrency(row.amountWeekly)} />
                    <Detail
                      label="Confirmed this month"
                      value={formatCurrency(row.contributedThisMonth)}
                    />
                    <Detail
                      label="Left this month"
                      value={formatCurrency(row.remainingMonthlyAllowance)}
                    />
                    <Detail
                      label="3 mo planned"
                      value={`+${formatCurrency(
                        forecasts.contributionRows.find(
                          (item) => item.allocationId === row.allocationId,
                        )?.contributionsByHorizon["3m"] ?? 0,
                      )}`}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 3. My Accounts */}
      <Card className={cn(compact && "border-white/[0.05]")}>
        <CardHeader
          title="3. My Accounts"
          description="Where paycheck pieces are parked"
        />
        <CardContent className="space-y-3">
          {forecasts.accounts.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Link a bank account on any item above to track balances here.
            </p>
          ) : (
            forecasts.accounts.map((account) => {
              const freshness = formatBalanceFreshness(account.lastSyncedAt);
              const liveAccount = accountsById.get(account.accountId);
              return (
                <div
                  key={account.accountId}
                  className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--foreground)]">
                        {liveAccount
                          ? formatBankAccountShort(liveAccount)
                          : account.accountName}
                      </p>
                      <p
                        className={cn(
                          "text-xs",
                          freshness.stale
                            ? "text-[var(--warning)]"
                            : "text-[var(--text-muted)]",
                        )}
                      >
                        {freshness.label}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[var(--text-muted)]">Actual money</p>
                      <p className="tabular-nums text-base font-semibold text-[var(--foreground)]">
                        {formatCurrency(account.currentBalance)}
                      </p>
                    </div>
                  </div>
                  <ul className="mt-2 space-y-1 border-t border-[var(--surface-border)] pt-2">
                    {account.purposes.map((purpose) => (
                      <li
                        key={purpose.allocationId}
                        className="flex justify-between gap-2 text-sm"
                      >
                        <span className="min-w-0 truncate text-[var(--text-secondary)]">
                          {purpose.name}
                          {account.isSharedDestination ? " (shared)" : ""}
                        </span>
                        <span className="shrink-0 tabular-nums text-[var(--foreground)]">
                          {formatCurrency(purpose.weeklyAddition)}/wk planned
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })
          )}
          {forecasts.unlinkedRows.length > 0 ? (
            <p className="text-xs text-[var(--text-muted)]">
              Not linked yet: {forecasts.unlinkedRows.map((row) => row.name).join(", ")}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* 4. Future Balances */}
      <Card className={cn(compact && "border-white/[0.05]")}>
        <CardHeader
          title="4. Future Balances"
          description="Actual money + planned in − bills, rent, debt, and other known outflows"
        />
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Time period">
            {FORECAST_HORIZONS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "min-h-11 rounded-xl px-3 text-sm font-medium transition",
                  horizonId === item.id
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--surface-subtle)] text-[var(--text-secondary)]",
                )}
                aria-pressed={horizonId === item.id}
                onClick={() => {
                  setHorizonId(item.id);
                  void triggerHaptic("selection");
                }}
              >
                {item.shortLabel}
              </button>
            ))}
          </div>

          {forecasts.accounts.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Link bank accounts to see future balances.
            </p>
          ) : (
            forecasts.accounts.map((account) => {
              const projection =
                account.horizons.find((item) => item.id === horizon.id) ??
                account.horizons[1];
              const withdrawals = account.upcomingWithdrawals.slice(0, 5);
              return (
                <div
                  key={account.accountId}
                  className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--foreground)]">
                        {account.accountName}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {account.balanceSource}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Weekly change {formatCurrency(account.weeklyNet)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[var(--text-muted)]">
                        In {horizon.label}
                      </p>
                      <p className="tabular-nums text-base font-semibold text-[var(--foreground)]">
                        {formatCurrency(projection.projectedBalance)}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">Projected</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                    <Detail
                      label={`Actual now (${account.balanceKind})`}
                      value={formatCurrency(account.currentBalance)}
                    />
                    <Detail
                      label="Planned in"
                      value={`+${formatCurrency(projection.plannedDeposits)}`}
                    />
                    <Detail
                      label="Money out"
                      value={`−${formatCurrency(projection.plannedWithdrawals)}`}
                    />
                  </div>
                  {withdrawals.length > 0 ? (
                    <div className="mt-3 space-y-1 border-t border-[var(--surface-border)] pt-2">
                      <p className="text-[11px] font-medium text-[var(--text-secondary)]">
                        Upcoming money out (weekly)
                      </p>
                      {withdrawals.map((line) => (
                        <div
                          key={line.id}
                          className="flex justify-between gap-2 text-xs text-[var(--text-muted)]"
                        >
                          <span className="min-w-0 truncate">
                            {line.name}
                            {line.confidence === "estimated" ? " · est." : ""}
                          </span>
                          <span className="shrink-0 tabular-nums">
                            −{formatCurrency(Math.abs(line.weeklyAmount))}
                          </span>
                        </div>
                      ))}
                      {account.upcomingWithdrawals.length > withdrawals.length ? (
                        <p className="text-[10px] text-[var(--text-muted)]">
                          +{account.upcomingWithdrawals.length - withdrawals.length} more
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {account.isSharedDestination ? (
                    <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                      Shared account — purposes listed separately; balance counted once.
                    </p>
                  ) : null}
                  {account.isStale ? (
                    <p className="mt-1 text-[11px] text-[var(--warning)]">
                      Bank data may be out of date — sync when you can.
                    </p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                    {account.estimateDisclaimer}
                  </p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <AllocationEditSheet
        target={editTarget}
        editAll={editAll}
        onClose={closeEditor}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-[var(--surface-subtle)] px-3 py-2.5">
      <p className="truncate text-[11px] font-medium text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium tabular-nums text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

export function BudgetInsightsSection({
  children,
  warningCount = 0,
}: {
  children: ReactNode;
  warningCount?: number;
}) {
  return (
    <MobileCollapsibleSection
      title="5. Suggestions"
      description={
        warningCount > 0
          ? `${warningCount} item${warningCount === 1 ? "" : "s"} to review`
          : "Optional tips — collapsed so your budget stays first"
      }
      defaultOpen={false}
      className="mt-4"
    >
      {children}
    </MobileCollapsibleSection>
  );
}
