"use client";

import { useMemo, useState } from "react";
import {
  IosBanner,
  IosHeroMetric,
  IosLink,
  IosList,
  IosListRow,
  IosScreen,
  IosSection,
  IosSkeletonScreen,
  IosTextButton,
} from "@/components/native/ios/IosPrimitives";
import { AddAccountModal } from "@/components/accounts/AddAccountModal";
import { BankSyncConnect } from "@/components/accounts/BankSyncPlaceholder";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";
import { isAccountVisible } from "@/lib/finance/accountPreferences";
import { getPlaidConnectionUiState } from "@/lib/native/plaidConnectionUi";
import { isPlaidClientEnabled } from "@/lib/plaid/clientConfig";
import { formatTransactionDate } from "@/lib/transactions";
import { cn } from "@/components/ui/cn";
import { triggerHaptic } from "@/lib/native/haptics";

const TYPE_ORDER = [
  "checking",
  "savings",
  "credit_card",
  "investment",
  "crypto",
  "cash",
] as const;

const TYPE_LABELS: Record<(typeof TYPE_ORDER)[number], string> = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit cards",
  investment: "Investments",
  crypto: "Crypto",
  cash: "Cash",
};

function formatSyncLabel(value: string | null | undefined): string {
  if (!value) return "Not synced yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not synced yet";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function IosAccountsScreen() {
  const finance = useFinance();
  const {
    isLoading,
    accounts,
    debts,
    bankConnections,
    transactions,
    syncBank,
    isSyncing,
  } = finance;
  const [addOpen, setAddOpen] = useState(false);
  const plaidEnabled = isPlaidClientEnabled();

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

  const visibleAccounts = useMemo(
    () => accounts.filter((account) => isAccountVisible(account)),
    [accounts],
  );

  const totalBalance = useMemo(
    () => visibleAccounts.reduce((sum, account) => sum + account.balance, 0),
    [visibleAccounts],
  );

  const grouped = useMemo(() => {
    return TYPE_ORDER.map((type) => ({
      type,
      label: TYPE_LABELS[type],
      items: visibleAccounts.filter((account) => account.type === type),
    })).filter((group) => group.items.length > 0);
  }, [visibleAccounts]);

  const recentTxns = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5),
    [transactions],
  );

  const latestSync = useMemo(() => {
    const times = connection.activeConnections
      .map((item) => item.lastSyncedAt)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => b.localeCompare(a));
    return times[0] ?? null;
  }, [connection.activeConnections]);

  if (connection.phase === "loading" || isLoading) {
    return <IosSkeletonScreen rows={6} />;
  }

  return (
    <IosScreen>
      <div className="flex items-start justify-between gap-3">
        <IosHeroMetric
          label="Total balances"
          value={formatCurrency(totalBalance)}
          hint={
            connection.phase === "connected"
              ? `Updated ${formatSyncLabel(latestSync)}`
              : "Cash and linked accounts"
          }
        />
        {connection.phase === "connected" || visibleAccounts.length > 0 ? (
          <IosTextButton
            onClick={() => {
              void triggerHaptic("light");
              setAddOpen(true);
            }}
          >
            Add
          </IosTextButton>
        ) : null}
      </div>

      {plaidEnabled && connection.phase === "empty" ? (
        <section className="ios-connect-panel rounded-[14px] bg-[var(--accent)]/10 px-4 py-5">
          <p className="text-[17px] font-semibold text-[var(--foreground)]">
            Connect Bank
          </p>
          <p className="mt-1 text-[13px] leading-snug text-[var(--text-muted)]">
            Link an institution to import balances and activity automatically.
          </p>
          <div className="mt-4">
            <BankSyncConnect buttonLabel="Connect Bank" inline />
          </div>
        </section>
      ) : null}

      {plaidEnabled && connection.reconnectConnections.length > 0 ? (
        <IosSection title="Needs Attention">
          {connection.reconnectConnections.map((item) => (
            <IosBanner
              key={item.id}
              tone="warning"
              title={`${item.institutionName ?? "Bank"} needs reconnect`}
              subtitle={item.errorMessage ?? "Sign in again to keep syncing"}
              action={
                <BankSyncConnect
                  connectionId={item.id}
                  mode="update"
                  compact
                  inline
                  buttonLabel="Reconnect"
                />
              }
            />
          ))}
        </IosSection>
      ) : null}

      {connection.phase === "connected" ? (
        <IosSection title="Institutions">
          <IosList>
            {connection.activeConnections.length === 0 ? (
              <IosListRow
                title="Linked accounts"
                subtitle="Synced from Plaid"
                trailing={
                  <button
                    type="button"
                    className="text-[13px] font-semibold text-[var(--accent-light)]"
                    onClick={() => setAddOpen(true)}
                  >
                    Add
                  </button>
                }
              />
            ) : (
              connection.activeConnections.map((item) => (
                <IosListRow
                  key={item.id}
                  title={item.institutionName ?? "Institution"}
                  subtitle={
                    item.status === "connected"
                      ? `Synced ${formatSyncLabel(item.lastSyncedAt)}`
                      : item.status
                  }
                  trailing={
                    <button
                      type="button"
                      disabled={isSyncing}
                      className="min-h-11 px-1 text-[13px] font-semibold text-[var(--accent-light)] disabled:opacity-50"
                      onClick={() => {
                        void triggerHaptic("light");
                        void syncBank(item.id);
                      }}
                    >
                      {isSyncing ? "…" : "Sync"}
                    </button>
                  }
                />
              ))
            )}
          </IosList>
          {plaidEnabled ? (
            <div className="mt-2 flex justify-end px-1">
              <BankSyncConnect compact inline buttonLabel="Add Account" />
            </div>
          ) : null}
        </IosSection>
      ) : null}

      {grouped.map((group) => (
        <IosSection key={group.type} title={group.label}>
          <IosList>
            {group.items.map((account) => (
              <IosListRow
                key={account.id}
                title={account.nickname || account.name}
                subtitle={
                  account.institution ||
                  (account.isPlaidLinked ? "Linked" : "Manual")
                }
                trailing={formatCurrency(account.balance)}
              />
            ))}
          </IosList>
        </IosSection>
      ))}

      {debts.some((debt) => debt.isPlaidLinked) ? (
        <IosSection
          title="Credit & loans"
          action={<IosLink href="/debt">View Details</IosLink>}
        >
          <IosList>
            {debts
              .filter((debt) => debt.isPlaidLinked || debt.balance > 0)
              .slice(0, 4)
              .map((debt) => (
                <IosListRow
                  key={debt.id}
                  title={debt.name}
                  subtitle={debt.institution ?? "Debt"}
                  trailing={formatCurrency(debt.balance)}
                  href="/debt"
                />
              ))}
          </IosList>
        </IosSection>
      ) : null}

      <IosSection
        title="Recent transactions"
        action={<IosLink href="/transactions">See All</IosLink>}
      >
        {recentTxns.length === 0 ? (
          <p className="px-1 text-[13px] text-[var(--text-muted)]">
            {connection.phase === "connected"
              ? "Waiting for the next sync."
              : "Connect a bank to import activity."}
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

      <AddAccountModal isOpen={addOpen} onClose={() => setAddOpen(false)} />
    </IosScreen>
  );
}
