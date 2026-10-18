"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { Button, Card, CardContent, CardHeader, Input } from "@/components/ui";
import { MobileCollapsibleSection } from "@/components/ui/MobileCollapsibleSection";
import { cn } from "@/components/ui/cn";
import { useFinance } from "@/context/FinanceContext";
import {
  FORECAST_HORIZONS_WEEKS,
  buildAccountForecasts,
  compareWhatIfForecasts,
  summarizeWhatIfPaycheck,
  type ForecastHorizonWeeks,
  type WhatIfAllocationOverride,
} from "@/lib/budgets/accountForecast";
import { buildPaycheckBreakdown } from "@/lib/budgets/paycheckBreakdown";
import { formatCurrency } from "@/lib/finance/format";
import { filterPersonalIncomePlan } from "@/lib/finance/personalIncomeScope";
import { INCOME_PLAN_SCHEDULE_LABELS } from "@/lib/incomePlan/types";
import { triggerHaptic } from "@/lib/native/haptics";

function formatSyncLabel(iso: string | null): string {
  if (!iso) return "Manual / unknown";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Manual / unknown";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function kindLabel(kind: string): string {
  switch (kind) {
    case "goal":
      return "Savings goal";
    case "bill":
      return "Bills";
    case "debt":
      return "Debt";
    case "remaining":
      return "Flexible / remaining";
    case "flexible":
      return "Spending / flexible";
    default:
      return "Allocation";
  }
}

type PaycheckPlanDashboardProps = {
  /** Compact layout for native iPhone screens. */
  compact?: boolean;
};

export function PaycheckPlanDashboard({ compact = false }: PaycheckPlanDashboardProps) {
  const finance = useFinance();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<ForecastHorizonWeeks>(13);
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [draftAmounts, setDraftAmounts] = useState<Record<string, string>>({});
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  const breakdown = useMemo(() => buildPaycheckBreakdown(finance), [finance]);
  const plan = useMemo(
    () => filterPersonalIncomePlan(finance.incomePlan, finance.viewerUserId ?? null),
    [finance.incomePlan, finance.viewerUserId],
  );

  const overrides: WhatIfAllocationOverride[] = useMemo(() => {
    if (!whatIfMode) return [];
    return breakdown.rows
      .filter((row) => row.kind !== "remaining")
      .map((row) => {
        const raw = draftAmounts[row.allocationId];
        const parsed = raw != null ? Number.parseFloat(raw) : row.amountPerPaycheck;
        return {
          allocationId: row.allocationId,
          amountPerPaycheck: Number.isFinite(parsed) ? Math.max(0, parsed) : row.amountPerPaycheck,
        };
      });
  }, [breakdown.rows, draftAmounts, whatIfMode]);

  const forecasts = useMemo(
    () =>
      whatIfMode
        ? compareWhatIfForecasts(finance, overrides, horizon)
        : {
            current: buildAccountForecasts(finance, { horizonWeeks: horizon }),
            proposed: buildAccountForecasts(finance, { horizonWeeks: horizon }),
            horizonWeeks: horizon,
          },
    [finance, horizon, overrides, whatIfMode],
  );

  const whatIfSummary = useMemo(
    () => summarizeWhatIfPaycheck(finance, overrides),
    [finance, overrides],
  );

  const eligibleAccounts = useMemo(
    () =>
      finance.accounts.filter(
        (account) =>
          !account.isHidden &&
          !account.archivedAt &&
          account.type !== "credit_card",
      ),
    [finance.accounts],
  );

  function enterWhatIf() {
    const next: Record<string, string> = {};
    for (const row of breakdown.rows) {
      if (row.kind === "remaining") continue;
      next[row.allocationId] = String(row.amountPerPaycheck);
    }
    setDraftAmounts(next);
    setWhatIfMode(true);
    void triggerHaptic("selection");
  }

  function cancelWhatIf() {
    setWhatIfMode(false);
    setDraftAmounts({});
    setSaveError(null);
  }

  function saveWhatIf() {
    if (!plan?.isActive) return;
    setSaveError(null);
    startSave(async () => {
      try {
        const allocations = plan.allocations.map((allocation) => {
          const override = overrides.find((item) => item.allocationId === allocation.id);
          const { id: _id, ...rest } = allocation;
          if (override != null && !allocation.isRemainingBalance) {
            return {
              ...rest,
              amount: override.amountPerPaycheck,
              percentage: null,
              allocationType: "fixed" as const,
            };
          }
          return rest;
        });
        await finance.saveIncomePlan({
          paySchedule: plan.paySchedule,
          paycheckAmount: plan.paycheckAmount,
          anchorDate: plan.anchorDate,
          weeklyDayOfWeek: plan.weeklyDayOfWeek,
          monthlyDays: plan.monthlyDays,
          customIntervalDays: plan.customIntervalDays,
          depositAccountId: plan.depositAccountId,
          ...(plan.linkedIncomeSourceId
            ? { linkedIncomeSourceId: plan.linkedIncomeSourceId }
            : {}),
          allocations,
        });
        void triggerHaptic("success");
        setWhatIfMode(false);
        setDraftAmounts({});
      } catch (error) {
        setSaveError(
          error instanceof Error ? error.message : "Could not save allocation changes.",
        );
      }
    });
  }

  function linkAccount(allocationId: string, accountId: string | null) {
    if (!plan?.isActive) return;
    // Owner-only: FinanceContext/RLS already scopes accounts to the viewer.
    // Reject IDs not in the viewer's eligible account list.
    if (accountId && !eligibleAccounts.some((account) => account.id === accountId)) {
      setSaveError("That account is not available on your profile.");
      return;
    }
    setLinkingId(allocationId);
    setSaveError(null);
    startSave(async () => {
      try {
        const allocations = plan.allocations.map((allocation) => {
          const { id: _id, ...rest } = allocation;
          if (allocation.id === allocationId) {
            return { ...rest, accountId };
          }
          return rest;
        });
        await finance.saveIncomePlan({
          paySchedule: plan.paySchedule,
          paycheckAmount: plan.paycheckAmount,
          anchorDate: plan.anchorDate,
          weeklyDayOfWeek: plan.weeklyDayOfWeek,
          monthlyDays: plan.monthlyDays,
          customIntervalDays: plan.customIntervalDays,
          depositAccountId: plan.depositAccountId,
          ...(plan.linkedIncomeSourceId
            ? { linkedIncomeSourceId: plan.linkedIncomeSourceId }
            : {}),
          allocations,
        });
        void triggerHaptic("success");
      } catch (error) {
        setSaveError(
          error instanceof Error ? error.message : "Could not update account link.",
        );
      } finally {
        setLinkingId(null);
      }
    });
  }

  if (!breakdown.hasPlan) {
    return (
      <Card className={cn(compact && "border-white/[0.05]")}>
        <CardHeader
          title="Paycheck overview"
          description="No active Income Plan yet. Category budgets still track spending limits separately from cash."
        />
        <CardContent>
          <p className="text-sm text-[var(--text-muted)]">
            Set up your Income Plan to see the full paycheck breakdown, account links, and
            savings projections here.
          </p>
          <Link
            href="/income?tab=plan"
            className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-white"
          >
            Open Income Plan
          </Link>
        </CardContent>
      </Card>
    );
  }

  const displayRows = whatIfMode
    ? breakdown.rows.map((row) => {
        const override = overrides.find((item) => item.allocationId === row.allocationId);
        if (!override || row.kind === "remaining") return row;
        const amount = override.amountPerPaycheck;
        return {
          ...row,
          amountPerPaycheck: amount,
          percentOfPaycheck:
            breakdown.paycheckAmount > 0
              ? Math.round((amount / breakdown.paycheckAmount) * 10000) / 100
              : 0,
        };
      })
    : breakdown.rows;

  const accountBundle = whatIfMode ? forecasts.proposed : forecasts.current;

  return (
    <div className="space-y-4">
      <Card className={cn(compact && "border-white/[0.05]")}>
        <CardHeader
          title="Weekly paycheck overview"
          description={
            plan
              ? `${INCOME_PLAN_SCHEDULE_LABELS[plan.paySchedule]} · from your saved Income Plan`
              : "From your saved Income Plan"
          }
        />
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Income" value={formatCurrency(breakdown.paycheckAmount)} />
            <Metric label="Allocated" value={formatCurrency(breakdown.totalAllocated)} />
            <Metric
              label="Unallocated"
              value={formatCurrency(
                whatIfMode ? whatIfSummary.unallocated : breakdown.unallocated,
              )}
            />
            <Metric
              label="Schedule"
              value={plan ? INCOME_PLAN_SCHEDULE_LABELS[plan.paySchedule] : "—"}
            />
          </div>
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            {breakdown.explanation}
          </p>
          <div className="flex flex-wrap gap-2">
            {!whatIfMode ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="min-h-11"
                onClick={enterWhatIf}
              >
                What-If mode
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  className="min-h-11"
                  disabled={isSaving}
                  onClick={saveWhatIf}
                >
                  {isSaving ? "Saving…" : "Save proposed plan"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="min-h-11"
                  disabled={isSaving}
                  onClick={cancelWhatIf}
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
          {whatIfMode ? (
            <p className="rounded-2xl bg-[var(--surface-subtle)] px-3 py-2 text-xs text-[var(--text-secondary)]">
              What-If adjusts planned contributions only — account balances stay unchanged until
              you confirm a paycheck. Proposed total{" "}
              <span className="font-semibold tabular-nums text-[var(--foreground)]">
                {formatCurrency(whatIfSummary.totalAllocated)}
              </span>
              {" · "}
              unallocated{" "}
              <span className="font-semibold tabular-nums text-[var(--foreground)]">
                {formatCurrency(whatIfSummary.unallocated)}
              </span>
              .
            </p>
          ) : null}
          {saveError ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {saveError}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className={cn(compact && "border-white/[0.05]")}>
        <CardHeader
          title="Allocation breakdown"
          description="Per paycheck · % · destination · goal/category · confirmed vs remaining"
        />
        <CardContent className="space-y-2">
          {displayRows.map((row) => {
            const open = expandedId === row.allocationId;
            return (
              <div
                key={row.allocationId}
                className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)]"
              >
                <button
                  type="button"
                  className="flex min-h-11 w-full items-start gap-3 px-3 py-3 text-left"
                  aria-expanded={open}
                  onClick={() =>
                    setExpandedId(open ? null : row.allocationId)
                  }
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
                    <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--text-muted)]">
                      <span>{row.percentOfPaycheck}% of paycheck</span>
                      <span>
                        {row.accountName
                          ? `→ ${row.accountName}`
                          : "No account linked"}
                      </span>
                    </span>
                  </span>
                </button>
                {open ? (
                  <div className="space-y-3 border-t border-[var(--surface-border)] px-3 py-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <Detail label="Per week" value={formatCurrency(row.amountWeekly)} />
                      <Detail label="Category" value={kindLabel(row.kind)} />
                      <Detail
                        label="Goal"
                        value={row.goalName ?? "—"}
                      />
                      <Detail
                        label="Confirmed this month"
                        value={formatCurrency(row.contributedThisMonth)}
                      />
                      <Detail
                        label="Monthly target"
                        value={formatCurrency(row.monthlyTarget)}
                      />
                      <Detail
                        label="Remaining allowance"
                        value={formatCurrency(row.remainingMonthlyAllowance)}
                      />
                    </div>
                    {row.purposeNote ? (
                      <p className="text-xs text-[var(--text-muted)]">{row.purposeNote}</p>
                    ) : null}
                    {whatIfMode && row.kind !== "remaining" ? (
                      <label className="block text-xs text-[var(--text-muted)]">
                        Proposed per paycheck
                        <Input
                          className="mt-1 min-h-11"
                          inputMode="decimal"
                          value={draftAmounts[row.allocationId] ?? ""}
                          onChange={(event) =>
                            setDraftAmounts((current) => ({
                              ...current,
                              [row.allocationId]: event.target.value,
                            }))
                          }
                          aria-label={`What-If amount for ${row.name}`}
                        />
                      </label>
                    ) : null}
                    <label className="block text-xs text-[var(--text-muted)]">
                      Destination account
                      <select
                        className="mt-1 min-h-11 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)]"
                        value={row.accountId ?? ""}
                        disabled={isSaving && linkingId === row.allocationId}
                        aria-label={`Destination account for ${row.name}`}
                        onChange={(event) =>
                          linkAccount(row.allocationId, event.target.value || null)
                        }
                      >
                        <option value="">None</option>
                        {eligibleAccounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.name}
                            {account.lastFour ? ` ···${account.lastFour}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Linking is for planning and tracking only — it does not move money.
                    </p>
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className={cn(compact && "border-white/[0.05]")}>
        <CardHeader
          title="Savings projections"
          description="Estimates from posted balances + planned weekly activity"
        />
        <CardContent className="space-y-4">
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label="Projection period"
          >
            {FORECAST_HORIZONS_WEEKS.map((weeks) => (
              <button
                key={weeks}
                type="button"
                className={cn(
                  "min-h-11 min-w-[3.25rem] rounded-xl px-3 text-sm font-medium transition",
                  horizon === weeks
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--surface-subtle)] text-[var(--text-secondary)]",
                )}
                aria-pressed={horizon === weeks}
                onClick={() => {
                  setHorizon(weeks);
                  void triggerHaptic("selection");
                }}
              >
                {weeks}w
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)]">{accountBundle.explanation}</p>
          {accountBundle.accounts.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Link allocations to accounts above to see balance projections.
            </p>
          ) : (
            accountBundle.accounts.map((account) => {
              const projection =
                account.horizons.find((item) => item.weeks === horizon) ??
                account.horizons[0];
              const baseline = whatIfMode
                ? forecasts.current.accounts.find(
                    (item) => item.accountId === account.accountId,
                  )
                : null;
              const baselineProjection = baseline?.horizons.find(
                (item) => item.weeks === horizon,
              );
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
                        Synced {formatSyncLabel(account.lastSyncedAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[var(--text-muted)]">Now</p>
                      <p className="tabular-nums font-semibold text-[var(--foreground)]">
                        {formatCurrency(account.currentBalance)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    <Detail
                      label={`In ${horizon} weeks`}
                      value={formatCurrency(projection.projectedBalance)}
                    />
                    <Detail
                      label="Weekly adds"
                      value={formatCurrency(account.weeklyPlannedDeposits)}
                    />
                    <Detail
                      label="Weekly bills out"
                      value={formatCurrency(account.weeklyPlannedWithdrawals)}
                    />
                    <Detail
                      label="Weekly net"
                      value={formatCurrency(account.weeklyNet)}
                    />
                  </div>
                  {whatIfMode && baselineProjection ? (
                    <p className="mt-2 text-xs text-[var(--text-secondary)]">
                      Current plan projects{" "}
                      <span className="tabular-nums font-medium text-[var(--foreground)]">
                        {formatCurrency(baselineProjection.projectedBalance)}
                      </span>
                      {" → "}
                      proposed{" "}
                      <span className="tabular-nums font-medium text-[var(--foreground)]">
                        {formatCurrency(projection.projectedBalance)}
                      </span>
                    </p>
                  ) : null}
                  {account.isSharedDestination ? (
                    <div className="mt-3 space-y-1 border-t border-[var(--surface-border)] pt-2">
                      <p className="text-xs font-medium text-[var(--text-secondary)]">
                        Purpose reserves (same account — not double-counted)
                      </p>
                      {account.purposes.map((purpose) => (
                        <div
                          key={purpose.allocationId}
                          className="flex justify-between gap-2 text-xs text-[var(--text-muted)]"
                        >
                          <span className="truncate">{purpose.name}</span>
                          <span className="shrink-0 tabular-nums">
                            {formatCurrency(purpose.plannedReserveAtHorizon)} planned @{" "}
                            {horizon}w
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <p className="mt-2 text-[11px] leading-snug text-[var(--text-muted)]">
                    {account.estimateDisclaimer}
                  </p>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
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

/** Collapsible insights wrapper — keeps recommendations below the main plan. */
export function BudgetInsightsSection({
  children,
  warningCount = 0,
}: {
  children: ReactNode;
  warningCount?: number;
}) {
  return (
    <MobileCollapsibleSection
      title="Insights & recommendations"
      description={
        warningCount > 0
          ? `${warningCount} item${warningCount === 1 ? "" : "s"} need attention`
          : "Suggestions stay here so your plan stays front and center"
      }
      defaultOpen={warningCount > 0}
      className="mt-4"
    >
      {children}
    </MobileCollapsibleSection>
  );
}
