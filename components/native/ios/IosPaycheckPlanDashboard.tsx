"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AllocationEditSheet } from "@/components/budgets/AllocationEditSheet";
import {
  IosCard,
  IosEmptyState,
  IosPrimaryButton,
  IosSection,
  IosTextButton,
} from "@/components/native/ios/IosPrimitives";
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

/**
 * Native Budgets paycheck plan — same engines as PaycheckPlanDashboard,
 * presented with iOS list/card chrome (no web Card embeds).
 */
export function IosPaycheckPlanDashboard() {
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
      <IosEmptyState
        title="No paycheck budget yet"
        subtitle="Safe to Spend still works from cash and bills. Set up your Income Plan once — then edit amounts and bank accounts here."
        action={
          <Link href="/income?tab=plan" className="block">
            <IosPrimaryButton>Set up My Budget</IosPrimaryButton>
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4" data-ios-paycheck-plan="true">
      <IosSection
        title="My Budget"
        action={
          <IosTextButton onClick={openEditBudget}>Edit Budget</IosTextButton>
        }
      >
        <IosCard padding="md">
          <p className="text-[12px] text-[var(--text-muted)]">
            {plan
              ? `${INCOME_PLAN_SCHEDULE_LABELS[plan.paySchedule]} income`
              : "Your paycheck plan"}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Metric label="Income" value={formatCurrency(breakdown.paycheckAmount)} />
            <Metric label="Allocated" value={formatCurrency(breakdown.totalAllocated)} />
            <Metric label="Left" value={formatCurrency(breakdown.unallocated)} />
          </div>
          <p className="mt-3 text-[12px] leading-snug text-[var(--text-muted)]">
            Tap a row to change amount or bank account. Planning only — money does not move
            automatically.
          </p>
        </IosCard>
      </IosSection>

      <IosSection title="Where money goes">
        <div className="overflow-hidden rounded-[16px] border border-white/[0.05] bg-[var(--surface)]">
          {breakdown.rows.map((row) => {
            const account = row.accountId ? accountsById.get(row.accountId) : null;
            const bankLabel = account
              ? formatBankAccountShort(account)
              : "No bank account linked";
            const showDetails = detailsId === row.allocationId;
            const threeMonth =
              forecasts.contributionRows.find(
                (item) => item.allocationId === row.allocationId,
              )?.contributionsByHorizon["3m"] ?? 0;
            return (
              <div
                key={row.allocationId}
                className="border-b border-white/[0.05] last:border-b-0"
              >
                <button
                  type="button"
                  className="flex min-h-[56px] w-full items-start gap-3 px-3.5 py-3 text-left active:bg-white/[0.03]"
                  onClick={() => openEdit(row.allocationId)}
                  aria-label={`Edit ${row.name}`}
                >
                  <span className="mt-0.5 text-[18px]" aria-hidden>
                    {row.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[15px] font-medium text-[var(--foreground)]">
                        {row.name}
                      </span>
                      <span className="shrink-0 text-[15px] font-semibold tabular-nums text-[var(--foreground)]">
                        {formatCurrency(row.amountPerPaycheck)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-[var(--text-muted)]">
                      {bankLabel} · {row.percentOfPaycheck}%
                      {row.goalName ? ` · ${row.goalName}` : ""}
                    </span>
                  </span>
                </button>
                <div className="flex border-t border-white/[0.05]">
                  <button
                    type="button"
                    className="min-h-11 flex-1 px-3.5 text-left text-[13px] font-semibold text-[var(--accent-light)]"
                    onClick={() => openEdit(row.allocationId)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="min-h-11 flex-1 px-3.5 text-left text-[13px] font-medium text-[var(--text-muted)]"
                    onClick={() => {
                      void triggerHaptic("selection");
                      setDetailsId(showDetails ? null : row.allocationId);
                    }}
                  >
                    {showDetails ? "Hide" : "Details"}
                  </button>
                </div>
                {showDetails ? (
                  <div className="grid grid-cols-2 gap-2 border-t border-white/[0.05] px-3.5 py-3">
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
                      value={`+${formatCurrency(threeMonth)}`}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </IosSection>

      <IosSection title="My Accounts">
        {forecasts.accounts.length === 0 ? (
          <IosCard padding="md">
            <p className="text-[13px] text-[var(--text-muted)]">
              Link a bank account on any item above to track balances here.
            </p>
          </IosCard>
        ) : (
          <div className="flex flex-col gap-2">
            {forecasts.accounts.map((account) => {
              const freshness = formatBalanceFreshness(account.lastSyncedAt);
              const liveAccount = accountsById.get(account.accountId);
              return (
                <IosCard key={account.accountId} padding="md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">
                        {liveAccount
                          ? formatBankAccountShort(liveAccount)
                          : account.accountName}
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 text-[12px]",
                          freshness.stale
                            ? "text-[var(--warning)]"
                            : "text-[var(--text-muted)]",
                        )}
                      >
                        {freshness.label}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-[var(--text-muted)]">Actual</p>
                      <p className="text-[15px] font-semibold tabular-nums text-[var(--foreground)]">
                        {formatCurrency(account.currentBalance)}
                      </p>
                    </div>
                  </div>
                  <ul className="mt-2 space-y-1 border-t border-white/[0.06] pt-2">
                    {account.purposes.map((purpose) => (
                      <li
                        key={purpose.allocationId}
                        className="flex justify-between gap-2 text-[13px]"
                      >
                        <span className="min-w-0 truncate text-[var(--text-secondary)]">
                          {purpose.name}
                          {account.isSharedDestination ? " (shared)" : ""}
                        </span>
                        <span className="shrink-0 tabular-nums text-[var(--foreground)]">
                          {formatCurrency(purpose.weeklyAddition)}/wk
                        </span>
                      </li>
                    ))}
                  </ul>
                </IosCard>
              );
            })}
          </div>
        )}
        {forecasts.unlinkedRows.length > 0 ? (
          <p className="mt-2 px-0.5 text-[12px] text-[var(--text-muted)]">
            Not linked: {forecasts.unlinkedRows.map((row) => row.name).join(", ")}
          </p>
        ) : null}
      </IosSection>

      <IosSection title="Future Balances">
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Time period">
          {FORECAST_HORIZONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "min-h-11 rounded-[12px] px-3.5 text-[13px] font-semibold active:opacity-80",
                horizonId === item.id
                  ? "bg-[var(--accent)] text-white"
                  : "bg-white/[0.06] text-[var(--text-secondary)]",
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
          <IosCard padding="md">
            <p className="text-[13px] text-[var(--text-muted)]">
              Link bank accounts to see future balances with bills and planned deposits.
            </p>
          </IosCard>
        ) : (
          <div className="flex flex-col gap-2">
            {forecasts.accounts.map((account) => {
              const projection =
                account.horizons.find((item) => item.id === horizon.id) ??
                account.horizons[1];
              const withdrawals = account.upcomingWithdrawals.slice(0, 5);
              return (
                <IosCard key={account.accountId} padding="md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">
                        {account.accountName}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                        Weekly change {formatCurrency(account.weeklyNet)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-[var(--text-muted)]">
                        In {horizon.label}
                      </p>
                      <p className="text-[16px] font-semibold tabular-nums text-[var(--foreground)]">
                        {formatCurrency(projection.projectedBalance)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Detail
                      label="Now"
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
                    <div className="mt-3 space-y-1 border-t border-white/[0.06] pt-2">
                      <p className="text-[11px] font-medium text-[var(--text-secondary)]">
                        Upcoming outflows
                      </p>
                      {withdrawals.map((line) => (
                        <div
                          key={line.id}
                          className="flex justify-between gap-2 text-[12px] text-[var(--text-muted)]"
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
                    </div>
                  ) : null}
                  <p className="mt-2 text-[11px] leading-snug text-[var(--text-muted)]">
                    {account.estimateDisclaimer}
                  </p>
                </IosCard>
              );
            })}
          </div>
        )}
      </IosSection>

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
    <div className="min-w-0 rounded-[12px] bg-white/[0.05] px-2.5 py-2">
      <p className="truncate text-[11px] font-medium text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 truncate text-[14px] font-semibold tabular-nums text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 truncate text-[13px] font-medium tabular-nums text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}
