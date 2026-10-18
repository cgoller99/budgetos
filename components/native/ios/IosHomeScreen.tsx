"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CashOutlookCard } from "@/components/dashboard/CashOutlookCard";
import { IosBudgetsSection } from "@/components/native/ios/IosBudgetsSection";
import { IosInsightsSection } from "@/components/native/ios/IosInsightsSection";
import { IosNetWorthHero } from "@/components/native/ios/IosNetWorthHero";
import { buildFinancialInsights } from "@/lib/automation/financialInsights";
import {
  IosAvatar,
  IosBanner,
  IosCard,
  IosLink,
  IosList,
  IosListRow,
  IosProgressBar,
  IosScreen,
  IosSection,
  IosSkeletonScreen,
} from "@/components/native/ios/IosPrimitives";
import { useAuth } from "@/context/AuthContext";
import { useFinance } from "@/context/FinanceContext";
import { readSavedCategoryBudgets } from "@/lib/automation/savedBudgets";
import { resolveCashAvailability } from "@/lib/calculations/availableCash";
import { forecastCashUntilPayday } from "@/lib/finance/cashFlowForecast";
import { getBillsDueThisWeek } from "@/lib/finance/bills";
import { enrichGoal } from "@/lib/finance/goals";
import { describeTimeRemaining } from "@/lib/native/timeRemaining";
import { formatCurrency } from "@/lib/finance/format";
import { getPlaidConnectionUiState } from "@/lib/native/plaidConnectionUi";
import { triggerHaptic } from "@/lib/native/haptics";
import { isPlaidClientEnabled } from "@/lib/plaid/clientConfig";
import { cn } from "@/components/ui/cn";
import { resolveAllocationAmounts } from "@/lib/incomePlan/allocations";

export function IosHomeScreen() {
  const finance = useFinance();
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Array<{ category: string; amount: number }>>([]);

  useEffect(() => {
    setBudgets(readSavedCategoryBudgets(user?.id));
  }, [user?.id]);

  const {
    isLoading,
    dashboard,
    bankConnections,
    accounts,
    debts,
    bills,
    income,
  } = finance;

  const connection = useMemo(
    () =>
      getPlaidConnectionUiState({
        isLoading,
        bankConnections,
        accounts,
        debts,
      }),
    [accounts, bankConnections, debts, isLoading],
  );

  const upcomingBills = useMemo(
    () => getBillsDueThisWeek(finance).slice(0, 3),
    [finance],
  );
  const insights = useMemo(
    () => buildFinancialInsights(finance, new Date(), budgets).slice(0, 2),
    [budgets, finance],
  );
  const featuredGoal = useMemo(() => {
    const summary = finance.dashboard.nextGoal;
    if (!summary) return null;
    const match = finance.savingsGoals.find((goal) => goal.id === summary.id);
    return match ? enrichGoal(finance, match) : null;
  }, [finance]);

  const paycheckAllocations = useMemo(() => {
    const plan = finance.incomePlan;
    if (!plan?.allocations?.length) {
      return [];
    }
    return resolveAllocationAmounts(plan)
      .filter((row) => row.amount > 0)
      .slice(0, 3)
      .map((row) => ({
        id: row.allocation.id,
        name: row.allocation.name,
        amount: row.amount,
      }));
  }, [finance.incomePlan]);

  if (isLoading) {
    return <IosSkeletonScreen rows={5} variant="home" />;
  }

  const moneyFlow = dashboard.moneyFlow;
  const safeToSpend = moneyFlow.safeToSpend;
  const availableCash = resolveCashAvailability(finance);
  const paydayForecast = forecastCashUntilPayday(finance);
  const nextPaycheck = dashboard.nextPaycheck;
  const nextGoal = dashboard.nextGoal;
  const debtsSummary = dashboard.debtsSummary;
  const spendHint = nextPaycheck
    ? `Until ${nextPaycheck.name} · ${nextPaycheck.formattedDate}`
    : "After bills, debt, and planned savings";

  const showConnectCue =
    isPlaidClientEnabled() &&
    connection.phase === "empty" &&
    accounts.length === 0 &&
    debts.length === 0;

  return (
    <IosScreen>
      {/* 1. Net Worth — first major card */}
      <IosNetWorthHero />

      {connection.reconnectConnections.length > 0 ? (
        <IosBanner
          tone="warning"
          title="Bank needs reconnect"
          subtitle={
            connection.reconnectConnections[0]?.institutionName ??
            "Keep balances in sync"
          }
          action={
            <Link
              href="/accounts"
              className="min-h-11 shrink-0 px-2 text-[13px] font-semibold text-[var(--accent-light)]"
            >
              Fix
            </Link>
          }
        />
      ) : null}

      {showConnectCue ? (
        <IosBanner
          title="Connect a bank"
          subtitle="Import balances and transactions"
          action={
            <Link
              href="/accounts"
              className="min-h-11 shrink-0 px-2 text-[13px] font-semibold text-[var(--accent-light)]"
            >
              Connect
            </Link>
          }
        />
      ) : null}

      {/* 2. Safe to Spend */}
      <Link
        href="/budgets"
        className="block active:opacity-95"
        onClick={() => {
          void triggerHaptic("selection");
        }}
        data-home-section="safe-to-spend"
      >
        <section className="rounded-[18px] border border-[var(--accent)]/25 bg-gradient-to-br from-[var(--accent)]/18 to-transparent p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-[var(--text-muted)]">
                Safe to Spend
              </p>
              <p
                className={cn(
                  "mt-1 min-w-0 break-words text-[clamp(1.5rem,7vw,1.75rem)] font-semibold leading-none tracking-tight tabular-nums",
                  safeToSpend < 0 ? "text-[var(--danger)]" : "text-[var(--foreground)]",
                )}
              >
                {formatCurrency(safeToSpend)}
              </p>
              <p className="mt-2 text-[12px] leading-snug text-[var(--text-secondary)]">
                {moneyFlow.income > 0
                  ? `Cash-capped after commitments · of ${formatCurrency(moneyFlow.income)} income`
                  : spendHint}
              </p>
              {moneyFlow.cashAvailabilityReason ? (
                <p className="mt-1 text-[12px] leading-snug text-[var(--warning)]">
                  {moneyFlow.cashAvailabilityStatus === "unavailable"
                    ? "Add a spendable cash account to unlock Safe to Spend."
                    : moneyFlow.cashAvailabilityReason}
                </p>
              ) : null}
              {paydayForecast.nextPayDate ? (
                <p className="mt-1 text-[12px] text-[var(--text-subtle)]">
                  {formatCurrency(paydayForecast.safeUntilPayday)} until payday after bills
                  due
                </p>
              ) : null}
            </div>
            <span className="text-[15px] text-[var(--accent-light)]" aria-hidden>
              ›
            </span>
          </div>
        </section>
      </Link>

      {/* 3. Available Cash */}
      <Link
        href="/accounts"
        className="block active:opacity-95"
        onClick={() => {
          void triggerHaptic("selection");
        }}
        data-home-section="available-cash"
      >
        <IosCard padding="md">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-[var(--text-muted)]">
                Available Cash
              </p>
              <p className="mt-1 min-w-0 break-words text-[clamp(1.25rem,6vw,1.375rem)] font-semibold tabular-nums text-[var(--foreground)]">
                {formatCurrency(availableCash.amount)}
              </p>
              <p className="mt-1 text-[12px] text-[var(--text-subtle)]">
                {availableCash.status === "unavailable"
                  ? "No spendable cash accounts yet"
                  : (availableCash.reason ??
                    `${availableCash.accountCount} spendable account${availableCash.accountCount === 1 ? "" : "s"}`)}
              </p>
            </div>
            <span className="text-[15px] text-[var(--accent-light)]" aria-hidden>
              ›
            </span>
          </div>
        </IosCard>
      </Link>

      {/* 4. Next Paycheck */}
      <IosSection
        title="Next Paycheck"
        action={<IosLink href="/income">Income Plan</IosLink>}
      >
        <IosList>
          {nextPaycheck ? (
            <IosListRow
              title={nextPaycheck.name}
              subtitle={`${nextPaycheck.formattedDate} · ${nextPaycheck.daysUntil === 0 ? "Today" : `${nextPaycheck.daysUntil}d`}`}
              leading={<IosAvatar fallback="$" tone="success" />}
              trailing={
                <span className="text-[var(--success)]">
                  +{formatCurrency(nextPaycheck.amount)}
                </span>
              }
              href="/income"
            />
          ) : (
            <IosListRow
              title={income.length === 0 ? "Add paycheck" : "Set next pay date"}
              subtitle="Plan allocations before payday"
              leading={<IosAvatar fallback="+" tone="muted" />}
              trailing={<span className="text-[var(--accent-light)]">›</span>}
              href="/income"
            />
          )}
        </IosList>
        {paycheckAllocations.length > 0 ? (
          <IosCard padding="md" className="mt-2">
            <p className="text-[12px] font-medium text-[var(--text-muted)]">
              Planned allocations
            </p>
            <ul className="mt-2 space-y-1.5">
              {paycheckAllocations.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 text-[13px]"
                >
                  <span className="min-w-0 truncate text-[var(--text-secondary)]">
                    {row.name}
                  </span>
                  <span className="shrink-0 tabular-nums text-[var(--foreground)]">
                    {formatCurrency(row.amount)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] leading-snug text-[var(--text-subtle)]">
              Planned — not yet moved until you confirm a paycheck.
            </p>
          </IosCard>
        ) : null}
      </IosSection>

      {/* 5. Budgets */}
      <IosBudgetsSection />

      {/* 6. Savings Goals */}
      <IosSection title="Savings Goals" action={<IosLink href="/savings">See All</IosLink>}>
        {nextGoal ? (
          <Link href="/savings" className="block active:opacity-90">
            <IosCard padding="md">
              <div className="flex items-center gap-3">
                <IosAvatar
                  fallback={nextGoal.icon || nextGoal.name.slice(0, 1)}
                  tone="accent"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">
                      {nextGoal.name}
                    </p>
                    <p className="text-[13px] font-semibold tabular-nums text-[var(--text-secondary)]">
                      {nextGoal.percentComplete}%
                    </p>
                  </div>
                  <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                    {featuredGoal
                      ? `${describeTimeRemaining(featuredGoal.estimatedCompletionDate)} · ${formatCurrency(featuredGoal.current)} of ${formatCurrency(featuredGoal.target)}`
                      : nextGoal.estimatedCompletionDate || "Progress"}
                  </p>
                </div>
              </div>
              <IosProgressBar value={nextGoal.percentComplete} className="mt-3" />
            </IosCard>
          </Link>
        ) : (
          <IosCard padding="md">
            <p className="text-[15px] font-semibold text-[var(--foreground)]">No goals yet</p>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">
              Create a goal to track progress without cluttering Home.
            </p>
            <Link
              href="/savings"
              className="mt-3 inline-flex min-h-11 items-center text-[13px] font-semibold text-[var(--accent-light)]"
            >
              Add a goal
            </Link>
          </IosCard>
        )}
      </IosSection>

      {/* 7. Upcoming Bills */}
      <IosSection title="Upcoming Bills" action={<IosLink href="/bills">See All</IosLink>}>
        <IosList>
          {upcomingBills.length > 0 ? (
            upcomingBills.map((bill) => (
              <IosListRow
                key={bill.id}
                title={bill.name}
                subtitle={`${bill.statusLabel} · ${bill.formattedDueDate}`}
                leading={
                  <IosAvatar
                    fallback={bill.name.slice(0, 1).toUpperCase()}
                    tone={bill.status === "overdue" ? "danger" : "accent"}
                  />
                }
                trailing={formatCurrency(bill.amount)}
                href="/bills"
                danger={bill.status === "overdue"}
              />
            ))
          ) : bills.length === 0 ? (
            <IosListRow
              title="Add bills"
              subtitle="Track what’s due next"
              leading={<IosAvatar fallback="B" tone="muted" />}
              trailing={<span className="text-[var(--accent-light)]">›</span>}
              href="/bills"
            />
          ) : (
            <IosListRow
              title="No bills due this week"
              subtitle="You’re clear for now"
              leading={<IosAvatar fallback="✓" tone="success" />}
              href="/bills"
            />
          )}
        </IosList>
      </IosSection>

      {/* 8. Debt Progress */}
      <IosSection title="Debt Progress" action={<IosLink href="/debt">Strategy</IosLink>}>
        {debtsSummary.activeDebtCount > 0 ? (
          <Link href="/debt" className="block active:opacity-90">
            <IosCard padding="md">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-[var(--foreground)]">
                    {formatCurrency(debtsSummary.totalDebt)} total
                  </p>
                  <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                    {debtsSummary.estimatedDebtFreeDate}
                    {debtsSummary.nextPayment
                      ? ` · Next ${formatCurrency(debtsSummary.nextPayment.amount)}`
                      : ""}
                  </p>
                </div>
                <p className="text-[13px] font-semibold tabular-nums text-[var(--text-secondary)]">
                  {Math.round(debtsSummary.debtFreeProgress)}%
                </p>
              </div>
              <IosProgressBar
                value={debtsSummary.debtFreeProgress}
                tone="warning"
                className="mt-3"
              />
            </IosCard>
          </Link>
        ) : (
          <IosCard padding="md">
            <p className="text-[15px] font-semibold text-[var(--foreground)]">No active debt</p>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">
              Add balances to track payoff progress.
            </p>
            <Link
              href="/debt"
              className="mt-3 inline-flex min-h-11 items-center text-[13px] font-semibold text-[var(--accent-light)]"
            >
              Open Debt Strategy
            </Link>
          </IosCard>
        )}
      </IosSection>

      {/* Supporting */}
      <CashOutlookCard detail="summary" />
      <IosInsightsSection insights={insights} />
    </IosScreen>
  );
}
