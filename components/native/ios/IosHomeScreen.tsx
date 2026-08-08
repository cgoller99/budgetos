"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  IosBanner,
  IosHeroMetric,
  IosLink,
  IosList,
  IosListRow,
  IosScreen,
  IosSection,
  IosSkeletonScreen,
} from "@/components/native/ios/IosPrimitives";
import { useFinance } from "@/context/FinanceContext";
import { getBillsDueThisWeek } from "@/lib/finance/bills";
import { formatCurrency } from "@/lib/finance/format";
import { getTopGoals } from "@/lib/finance/goals";
import { formatTransactionDate } from "@/lib/transactions";
import { getPlaidConnectionUiState } from "@/lib/native/plaidConnectionUi";
import { isPlaidClientEnabled } from "@/lib/plaid/clientConfig";
import { cn } from "@/components/ui/cn";

type AttentionItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  tone?: "warning" | "danger";
};

export function IosHomeScreen() {
  const finance = useFinance();
  const {
    isLoading,
    dashboard,
    transactions,
    bankConnections,
    accounts,
    debts,
    bills,
    income,
    savingsGoals,
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

  const topGoal = useMemo(() => getTopGoals(finance, 1)[0] ?? null, [finance]);

  const attention = useMemo(() => {
    const items: AttentionItem[] = [];

    for (const connectionItem of connection.reconnectConnections) {
      items.push({
        id: `reconnect-${connectionItem.id}`,
        title: "Bank needs reconnect",
        subtitle: connectionItem.institutionName ?? "Linked institution",
        href: "/accounts",
        tone: "danger",
      });
    }

    const overdueCount = getBillsDueThisWeek(finance).filter(
      (bill) => bill.status === "overdue",
    ).length;
    if (overdueCount > 0) {
      items.push({
        id: "overdue-bills",
        title: `${overdueCount} overdue bill${overdueCount === 1 ? "" : "s"}`,
        subtitle: "Review and mark paid",
        href: "/bills",
        tone: "danger",
      });
    }

    return items.slice(0, 3);
  }, [connection.reconnectConnections, finance]);

  if (isLoading) {
    return <IosSkeletonScreen rows={5} />;
  }

  const safeToSpend = dashboard.moneyFlow.safeToSpend;
  const nextPaycheck = dashboard.nextPaycheck;
  const showConnectCue =
    isPlaidClientEnabled() &&
    connection.phase === "empty" &&
    accounts.length === 0 &&
    debts.length === 0;

  const showIncomeCue = income.length === 0 && bills.length === 0;
  const showGoalCue = savingsGoals.length === 0;

  return (
    <IosScreen>
      <IosHeroMetric
        label="Safe to Spend"
        value={formatCurrency(safeToSpend)}
        hint="Left after bills, debt, and planned savings"
        tone={safeToSpend >= 0 ? "default" : "danger"}
      />

      {attention.length > 0 ? (
        <IosSection title="Needs Attention">
          <IosList>
            {attention.map((item) => (
              <IosListRow
                key={item.id}
                title={item.title}
                subtitle={item.subtitle}
                href={item.href}
                danger={item.tone === "danger"}
                trailing={<span className="text-[var(--accent-light)]">›</span>}
              />
            ))}
          </IosList>
        </IosSection>
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

      <IosSection title="Coming Up">
        <IosList>
          {nextPaycheck ? (
            <IosListRow
              title={nextPaycheck.name}
              subtitle={`Paycheck · ${nextPaycheck.formattedDate}`}
              trailing={
                <span className="text-emerald-400">
                  +{formatCurrency(nextPaycheck.amount)}
                </span>
              }
              href="/income"
            />
          ) : showIncomeCue ? (
            <IosListRow
              title="Add income"
              subtitle="So paycheck timing shows here"
              href="/income"
              trailing={<span className="text-[var(--accent-light)]">›</span>}
            />
          ) : null}

          {upcomingBills.length > 0 ? (
            upcomingBills.map((bill) => (
              <IosListRow
                key={bill.id}
                title={bill.name}
                subtitle={`${bill.statusLabel} · ${bill.formattedDueDate}`}
                trailing={formatCurrency(bill.amount)}
                href="/bills"
                danger={bill.status === "overdue"}
              />
            ))
          ) : bills.length === 0 ? (
            <IosListRow
              title="Add bills"
              subtitle="Track what’s due next"
              href="/bills"
              trailing={<span className="text-[var(--accent-light)]">›</span>}
            />
          ) : (
            <IosListRow
              title="No bills due this week"
              subtitle="You’re clear for now"
              href="/bills"
            />
          )}
        </IosList>
        {(upcomingBills.length > 0 || nextPaycheck) && (
          <div className="mt-2 flex justify-end px-1">
            <IosLink href="/bills">See All</IosLink>
          </div>
        )}
      </IosSection>

      <IosSection
        title="Recent"
        action={<IosLink href="/transactions">See All</IosLink>}
      >
        {recentTxns.length === 0 ? (
          <p className="px-1 text-[13px] text-[var(--text-muted)]">
            Transactions appear after you connect a bank or add activity.
          </p>
        ) : (
          <IosList>
            {recentTxns.map((transaction) => {
              const signed =
                transaction.type === "expense"
                  ? -transaction.amount
                  : transaction.amount;
              return (
                <IosListRow
                  key={transaction.id}
                  title={transaction.notes || transaction.category}
                  subtitle={formatTransactionDate(transaction.date)}
                  trailing={
                    <span
                      className={cn(
                        signed >= 0 ? "text-emerald-400" : "text-[var(--text-secondary)]",
                      )}
                    >
                      {signed >= 0 ? "+" : "−"}
                      {formatCurrency(Math.abs(signed))}
                    </span>
                  }
                  href="/transactions"
                />
              );
            })}
          </IosList>
        )}
      </IosSection>

      {topGoal ? (
        <IosSection
          title="Goal"
          action={<IosLink href="/savings">View Details</IosLink>}
        >
          <IosList>
            <IosListRow
              title={topGoal.name}
              subtitle={`${topGoal.percentComplete}% · ${formatCurrency(topGoal.remaining)} left`}
              trailing={`${topGoal.percentComplete}%`}
              href="/savings"
            />
          </IosList>
        </IosSection>
      ) : showGoalCue && !showConnectCue ? (
        <IosSection title="Goal">
          <IosList>
            <IosListRow
              title="Set a savings goal"
              subtitle="Optional — keep Home focused"
              href="/savings"
              trailing={<span className="text-[var(--accent-light)]">›</span>}
            />
          </IosList>
        </IosSection>
      ) : null}
    </IosScreen>
  );
}
