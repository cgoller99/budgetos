"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Sparkline } from "@/components/charts/Sparkline";
import { CHART_COLORS } from "@/components/charts/constants";
import {
  IosAvatar,
  IosBanner,
  IosCard,
  IosLink,
  IosList,
  IosListRow,
  IosProgressBar,
  IosRing,
  IosScreen,
  IosSection,
  IosSkeletonScreen,
} from "@/components/native/ios/IosPrimitives";
import { useFinance } from "@/context/FinanceContext";
import { getBillsDueThisWeek } from "@/lib/finance/bills";
import { formatCurrency, formatMonthlyChange } from "@/lib/finance/format";
import { formatTransactionDate } from "@/lib/transactions";
import {
  getDisplayCategory,
  getDisplayMerchant,
} from "@/lib/transactions/categoryPresentation";
import { isConfidentInternalTransfer } from "@/lib/transactions/transferDetection";
import { getPlaidConnectionUiState } from "@/lib/native/plaidConnectionUi";
import { isPlaidClientEnabled } from "@/lib/plaid/clientConfig";
import { cn } from "@/components/ui/cn";

export function IosHomeScreen() {
  const finance = useFinance();
  const {
    isLoading,
    dashboard,
    snapshot,
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

  const recentTxns = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 4),
    [transactions],
  );

  const netWorthSpark = useMemo(
    () => snapshot.monthlyTrends.map((point) => point.income - point.spending),
    [snapshot.monthlyTrends],
  );

  if (isLoading) {
    return <IosSkeletonScreen rows={4} />;
  }

  const netWorth = dashboard.kpiMetrics.find((metric) => metric.label === "Net Worth");
  const cash = dashboard.kpiMetrics.find((metric) => metric.label === "Cash");
  const debt = dashboard.kpiMetrics.find((metric) => metric.label === "Debt");
  const moneyFlow = dashboard.moneyFlow;
  const safeToSpend = moneyFlow.safeToSpend;
  const plannedBudget = Math.max(moneyFlow.income, 1);
  const safeProgress = Math.max(
    0,
    Math.min(100, (Math.max(safeToSpend, 0) / plannedBudget) * 100),
  );
  const health = dashboard.financialHealthScore;
  const nextPaycheck = dashboard.nextPaycheck;

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

  const flowSegments = [
    { label: "Income", value: Math.max(moneyFlow.income, 0), color: "bg-[var(--success)]" },
    { label: "Bills", value: Math.max(moneyFlow.bills, 0), color: "bg-[var(--accent)]" },
    {
      label: "Expenses",
      value: Math.max(moneyFlow.debts + moneyFlow.goals + moneyFlow.investments, 0),
      color: "bg-[var(--warning)]",
    },
    {
      label: "Left",
      value: Math.max(safeToSpend, 0),
      color: "bg-white/25",
    },
  ];
  const flowTotal = Math.max(moneyFlow.income, 1);

  return (
    <IosScreen>
      <IosCard padding="lg" className="bg-gradient-to-br from-[var(--accent)]/16 via-[var(--surface)] to-[var(--surface)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-[var(--text-muted)]">Net Worth</p>
            <p className="mt-1.5 text-[34px] font-semibold leading-none tracking-tight tabular-nums text-[var(--foreground)]">
              {netWorth ? formatCurrency(netWorth.value) : "—"}
            </p>
            {netWorth ? (
              <p
                className={cn(
                  "mt-2 text-[13px] font-medium",
                  (netWorth.monthlyChange ?? 0) >= 0
                    ? "text-[var(--success)]"
                    : "text-[var(--danger)]",
                )}
              >
                {formatMonthlyChange(netWorth.monthlyChange)}
              </p>
            ) : null}
          </div>
          <Sparkline
            values={netWorthSpark.length > 1 ? netWorthSpark : [0, 2, 1, 4, 3, 5]}
            color={CHART_COLORS.primary}
            width={112}
            height={48}
            className="mt-1 opacity-90"
          />
        </div>
      </IosCard>

      <div className="grid grid-cols-2 gap-3">
        <IosCard padding="md">
          <p className="text-[12px] font-medium text-[var(--text-muted)]">Cash</p>
          <p className="mt-1 text-[20px] font-semibold tabular-nums text-[var(--foreground)]">
            {cash ? formatCurrency(cash.value) : formatCurrency(0)}
          </p>
          <p className="mt-2 text-[11px] leading-snug text-[var(--text-subtle)]">
            Checking {formatCurrency(checking)} · Savings {formatCurrency(savings)}
          </p>
        </IosCard>

        <IosCard padding="md">
          <p className="text-[12px] font-medium text-[var(--text-muted)]">Debt</p>
          <p className="mt-1 text-[20px] font-semibold tabular-nums text-[var(--foreground)]">
            {debt ? formatCurrency(debt.value) : formatCurrency(0)}
          </p>
          <p className="mt-2 text-[11px] text-[var(--text-subtle)]">
            {debt ? formatMonthlyChange(debt.monthlyChange) : "No balances"}
          </p>
        </IosCard>

        <IosCard padding="md">
          <p className="text-[12px] font-medium text-[var(--text-muted)]">Safe to Spend</p>
          <p className="mt-1 text-[20px] font-semibold tabular-nums text-[var(--foreground)]">
            {formatCurrency(safeToSpend)}
          </p>
          <IosProgressBar value={safeProgress} className="mt-3" />
        </IosCard>

        <IosCard padding="md" className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[12px] font-medium text-[var(--text-muted)]">Health</p>
            <p className="mt-1 text-[20px] font-semibold tabular-nums text-[var(--foreground)]">
              {health.score}
              <span className="text-[12px] font-medium text-[var(--text-muted)]">/100</span>
            </p>
          </div>
          <IosRing value={health.score} label={`${health.score}`} size={52} />
        </IosCard>
      </div>

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
              const isIncome = transaction.type === "income" && !isTransfer;
              const label = getDisplayMerchant({
                notes: transaction.notes,
                category: transaction.category,
                type: isTransfer ? "transfer" : transaction.type,
              });
              const category = isTransfer
                ? "Transfer"
                : getDisplayCategory(transaction.category);
              return (
                <IosListRow
                  key={transaction.id}
                  title={label}
                  subtitle={`${formatTransactionDate(transaction.date)} · ${category}`}
                  leading={
                    <IosAvatar
                      fallback={label.slice(0, 1).toUpperCase()}
                      tone={isIncome ? "success" : "muted"}
                    />
                  }
                  trailing={
                    <span
                      className={cn(
                        isIncome ? "text-[var(--success)]" : "text-[var(--foreground)]",
                      )}
                    >
                      {isIncome ? "+" : "−"}
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

      <IosSection title="Cash Flow">
        <IosCard padding="md">
          <div className="flex h-3 overflow-hidden rounded-full bg-white/[0.06]">
            {flowSegments.map((segment) => (
              <div
                key={segment.label}
                className={cn(segment.color)}
                style={{ width: `${(segment.value / flowTotal) * 100}%` }}
                title={segment.label}
              />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {flowSegments.map((segment) => (
              <div key={segment.label} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
                  <span className={cn("size-2 rounded-full", segment.color)} />
                  {segment.label}
                </span>
                <span className="text-[12px] font-medium tabular-nums text-[var(--text-secondary)]">
                  {formatCurrency(segment.value)}
                </span>
              </div>
            ))}
          </div>
        </IosCard>
      </IosSection>
    </IosScreen>
  );
}
