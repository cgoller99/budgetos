"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CashOutlookCard } from "@/components/dashboard/CashOutlookCard";
import { IosBudgetsSection } from "@/components/native/ios/IosBudgetsSection";
import { IosInsightsSection } from "@/components/native/ios/IosInsightsSection";
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
import { forecastCashUntilPayday } from "@/lib/finance/cashFlowForecast";
import { describeCashOutlook, forecastCashOutlook } from "@/lib/finance/cashOutlook";
import { getBillsDueThisWeek } from "@/lib/finance/bills";
import { enrichGoal } from "@/lib/finance/goals";
import { describeTimeRemaining } from "@/lib/native/timeRemaining";
import {
  formatCurrency,
  formatMonthlyChange,
  formatSignedCurrency,
} from "@/lib/finance/format";
import { formatTransactionDate } from "@/lib/transactions";
import {
  getDisplayCategory,
  getDisplayMerchant,
} from "@/lib/transactions/categoryPresentation";
import { isDisplayedInflow, isRefundActivity } from "@/lib/transactions/refunds";
import { IosMerchantMark } from "@/components/native/ios/IosMerchantMark";
import { isConfidentInternalTransfer } from "@/lib/transactions/transferDetection";
import { getPlaidConnectionUiState } from "@/lib/native/plaidConnectionUi";
import { triggerHaptic } from "@/lib/native/haptics";
import { isPlaidClientEnabled } from "@/lib/plaid/clientConfig";
import { cn } from "@/components/ui/cn";

function metricDelta(value: number, monthlyChange: number, favorableWhenDown = false) {
  const previous = value - monthlyChange;
  const percent =
    previous !== 0 && Number.isFinite(previous)
      ? (monthlyChange / Math.abs(previous)) * 100
      : null;
  const label =
    percent !== null && Number.isFinite(percent)
      ? `${percent > 0 ? "+" : ""}${percent.toFixed(1)}%`
      : formatSignedCurrency(monthlyChange);
  const favorable = favorableWhenDown ? monthlyChange <= 0 : monthlyChange >= 0;
  return { label, favorable };
}

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
    transactions,
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

  const recentTxns = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 4),
    [transactions],
  );

  if (isLoading) {
    return <IosSkeletonScreen rows={4} variant="home" />;
  }

  const netWorth = dashboard.kpiMetrics.find((metric) => metric.label === "Net Worth");
  const cash = dashboard.kpiMetrics.find((metric) => metric.label === "Cash");
  const debt = dashboard.kpiMetrics.find((metric) => metric.label === "Debt");
  const moneyFlow = dashboard.moneyFlow;
  const safeToSpend = moneyFlow.safeToSpend;
  const paydayForecast = forecastCashUntilPayday(finance);
  const cashOutlook = describeCashOutlook(forecastCashOutlook(finance));
  const nextPaycheck = dashboard.nextPaycheck;
  const nextGoal = dashboard.nextGoal;
  const spendHint = nextPaycheck
    ? `Until ${nextPaycheck.name} · ${nextPaycheck.formattedDate}`
    : "After bills, debt, and goals";

  const checking = accounts
    .filter((account) => account.type === "checking")
    .reduce((sum, account) => sum + account.balance, 0);
  const savings = accounts
    .filter((account) => account.type === "savings")
    .reduce((sum, account) => sum + account.balance, 0);

  const showConnectCue =
    isPlaidClientEnabled() &&
    connection.phase === "empty" &&
    accounts.length === 0 &&
    debts.length === 0;

  const cashDelta = metricDelta(cash?.value ?? 0, cash?.monthlyChange ?? 0);
  const debtDelta = metricDelta(debt?.value ?? 0, debt?.monthlyChange ?? 0, true);
  const netWorthDelta = metricDelta(netWorth?.value ?? 0, netWorth?.monthlyChange ?? 0);

  return (
    <IosScreen>
      <section
        className="ios-home-hero rounded-[22px] bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent-hover)] p-5 text-white shadow-[0_16px_40px_rgba(37,99,235,0.28)]"
        data-home-hero="safe-to-spend"
      >
        <p className="text-[13px] font-medium text-white/80">Safe to Spend</p>
        <p
          className={cn(
            "mt-1.5 text-[40px] font-semibold leading-none tracking-tight tabular-nums",
            safeToSpend < 0 ? "text-[var(--danger)]" : "text-white",
          )}
        >
          {formatCurrency(safeToSpend)}
        </p>
        <p className="mt-2 text-[13px] leading-snug text-white/75">
          {moneyFlow.income > 0
            ? `of ${formatCurrency(moneyFlow.income)} this month`
            : spendHint}
        </p>
        <p className="mt-3 text-[15px] font-medium text-white">
          Available cash{" "}
          <span className="tabular-nums">{formatCurrency(checking)}</span>
        </p>
        {moneyFlow.cashAvailabilityReason ? (
          <p className="mt-1 text-[12px] leading-snug text-amber-100/90">
            {moneyFlow.cashAvailabilityStatus === "unavailable"
              ? "Safe to Spend unavailable — add a spendable cash account."
              : moneyFlow.cashAvailabilityReason}
          </p>
        ) : null}
        {paydayForecast.nextPayDate ? (
          <p className="mt-1 text-[12px] leading-snug text-white/75">
            {formatCurrency(paydayForecast.safeUntilPayday)} until payday after bills due
          </p>
        ) : null}
        {cashOutlook ? (
          <p className="mt-1 text-[12px] leading-snug text-white/75">{cashOutlook}</p>
        ) : null}
      </section>

      <div className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Link
          href="/income"
          className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-[var(--accent)] px-3.5 text-[15px] font-semibold text-white"
        >
          {nextPaycheck ? "Paycheck" : "Add paycheck"}
        </Link>
        <Link
          href="/bills"
          className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-white/[0.06] px-3.5 text-[15px] font-semibold text-[var(--foreground)]"
        >
          {upcomingBills.some((bill) => bill.status === "overdue") ? "Review bills" : "Bills"}
        </Link>
        <Link
          href="/budgets"
          className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-white/[0.06] px-3.5 text-[15px] font-semibold text-[var(--foreground)]"
          onClick={() => {
            void triggerHaptic("selection");
          }}
        >
          Budgets
        </Link>
        <Link
          href="/savings"
          className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-white/[0.06] px-3.5 text-[15px] font-semibold text-[var(--foreground)]"
        >
          Goals
        </Link>
      </div>

      <div className="grid min-w-0 grid-cols-3 gap-2">
        <Link
          href="/accounts"
          className="ios-metric-chip flex min-h-[72px] min-w-0 flex-col justify-center gap-0.5 rounded-[16px] bg-[var(--surface)] px-3 py-2.5 active:bg-white/[0.06]"
        >
          <span className="text-[11px] font-medium text-[var(--text-muted)]">Cash</span>
          <strong className="text-[15px] font-semibold tabular-nums text-[var(--foreground)]">
            {formatCurrency(cash?.value ?? 0)}
          </strong>
          <span
            className={cn(
              "text-[11px] font-semibold tabular-nums",
              cashDelta.favorable ? "text-[var(--success)]" : "text-[var(--danger)]",
            )}
          >
            {cashDelta.label}
          </span>
        </Link>
        <Link
          href="/debt"
          className="ios-metric-chip flex min-h-[72px] min-w-0 flex-col justify-center gap-0.5 rounded-[16px] bg-[var(--surface)] px-3 py-2.5 active:bg-white/[0.06]"
        >
          <span className="text-[11px] font-medium text-[var(--text-muted)]">Debt</span>
          <strong className="text-[15px] font-semibold tabular-nums text-[var(--foreground)]">
            {formatCurrency(debt?.value ?? 0)}
          </strong>
          <span
            className={cn(
              "text-[11px] font-semibold tabular-nums",
              debtDelta.favorable ? "text-[var(--success)]" : "text-[var(--danger)]",
            )}
          >
            {debtDelta.label}
          </span>
        </Link>
        <Link
          href="/accounts"
          className="ios-metric-chip flex min-h-[72px] min-w-0 flex-col justify-center gap-0.5 rounded-[16px] bg-[var(--surface)] px-3 py-2.5 active:bg-white/[0.06]"
        >
          <span className="text-[11px] font-medium text-[var(--text-muted)]">Net Worth</span>
          <strong className="text-[15px] font-semibold tabular-nums text-[var(--foreground)]">
            {netWorth ? formatCurrency(netWorth.value) : "—"}
          </strong>
          <span
            className={cn(
              "text-[11px] font-semibold tabular-nums",
              netWorthDelta.favorable ? "text-[var(--success)]" : "text-[var(--danger)]",
            )}
          >
            {netWorthDelta.label}
          </span>
        </Link>
      </div>
      <p className="px-0.5 text-[11px] leading-snug text-[var(--text-subtle)]">
        Checking {formatCurrency(checking)} · Savings {formatCurrency(savings)}
        {netWorth ? ` · ${formatMonthlyChange(netWorth.monthlyChange)}` : ""}
      </p>

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

      <IosSection title="Upcoming" action={<IosLink href="/bills">See All</IosLink>}>
        <IosList>
          {nextPaycheck ? (
            <IosListRow
              title={nextPaycheck.name}
              subtitle={`Paycheck · ${nextPaycheck.formattedDate}`}
              leading={<IosAvatar fallback="$" tone="success" />}
              trailing={
                <span className="text-[var(--success)]">
                  +{formatCurrency(nextPaycheck.amount)}
                </span>
              }
              href="/income"
            />
          ) : income.length === 0 ? (
            <IosListRow
              title="Add income"
              subtitle="Show your next paycheck here"
              leading={<IosAvatar fallback="+" tone="muted" />}
              trailing={<span className="text-[var(--accent-light)]">›</span>}
              href="/income"
            />
          ) : null}

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

      {nextGoal ? (
        <IosSection title="Next Goal" action={<IosLink href="/savings">See All</IosLink>}>
          <Link href="/savings" className="block active:opacity-90">
            <IosCard padding="md">
              <div className="flex items-center gap-3">
                <IosAvatar fallback={nextGoal.icon || nextGoal.name.slice(0, 1)} tone="accent" />
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
        </IosSection>
      ) : null}

      <IosInsightsSection insights={insights} />
      <IosBudgetsSection />
      <CashOutlookCard detail="summary" />

      <IosSection
        title="Recent"
        action={<IosLink href="/transactions">See All</IosLink>}
      >
        {recentTxns.length === 0 ? (
          <IosCard padding="md">
            <p className="text-[13px] text-[var(--text-muted)]">
              Transactions appear after you connect a bank or add activity.
            </p>
          </IosCard>
        ) : (
          <IosList>
            {recentTxns.map((transaction) => {
              const isTransfer = isConfidentInternalTransfer(finance, transaction);
              const isRefund = !isTransfer && isRefundActivity(transaction);
              const isInflow = !isTransfer && isDisplayedInflow(transaction);
              const label = getDisplayMerchant({
                notes: transaction.notes,
                category: transaction.category,
                type: isTransfer ? "transfer" : transaction.type,
              });
              const category = isTransfer
                ? "Transfer"
                : getDisplayCategory(transaction.category);
              const kind = isTransfer
                ? "transfer"
                : isRefund
                  ? "refund"
                  : isInflow
                    ? "income"
                    : "spending";
              const kindLabel =
                kind === "transfer"
                  ? "Transfer"
                  : kind === "refund"
                    ? "Refund"
                    : kind === "income"
                      ? "Income"
                      : "Spending";
              return (
                <IosListRow
                  key={transaction.id}
                  title={label}
                  subtitle={`${kindLabel} · ${formatTransactionDate(transaction.date)}`}
                  leading={
                    <IosAvatar
                      fallback={<IosMerchantMark category={category} kind={kind} />}
                      tone={isRefund || isInflow ? "success" : isTransfer ? "muted" : "accent"}
                    />
                  }
                  trailing={
                    <span
                      className={cn(
                        isInflow ? "text-[var(--success)]" : "text-[var(--foreground)]",
                      )}
                    >
                      {isInflow ? "+" : "−"}
                      {formatCurrency(Math.abs(transaction.amount))}
                    </span>
                  }
                  href="/transactions"
                />
              );
            })}
          </IosList>
        )}
      </IosSection>
    </IosScreen>
  );
}
