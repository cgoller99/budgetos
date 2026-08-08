"use client";

import { useMemo, useState } from "react";
import {
  IosAvatar,
  IosBanner,
  IosCard,
  IosHeroMetric,
  IosIconButton,
  IosLink,
  IosList,
  IosListRow,
  IosPrimaryButton,
  IosScreen,
  IosSection,
  IosSkeletonScreen,
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

function maskLastFour(value?: string | null): string | null {
  if (!value) return null;
  return `•••• ${value.slice(-4)}`;
}

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

  const groups = useMemo(() => {
    const cash = visibleAccounts.filter(
      (account) =>
        account.type === "checking" ||
        account.type === "savings" ||
        account.type === "cash",
    );
    const cards = visibleAccounts.filter((account) => account.type === "credit_card");
    const investments = visibleAccounts.filter(
      (account) => account.type === "investment" || account.type === "crypto",
    );
    return [
      { key: "cash", label: "Cash", items: cash },
      { key: "cards", label: "Credit Cards", items: cards },
      { key: "investments", label: "Investments", items: investments },
    ].filter((group) => group.items.length > 0);
  }, [visibleAccounts]);

  const recentTxns = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 4),
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
      <div className="flex items-start justify-between gap-3 px-0.5">
        <IosHeroMetric
          label="Total Balance"
          value={formatCurrency(totalBalance)}
          hint={
            connection.phase === "connected"
              ? `Updated ${formatSyncLabel(latestSync)}`
              : "Cash and linked accounts"
          }
        />
        <IosIconButton
          label="Add account"
          onClick={() => {
            void triggerHaptic("light");
            setAddOpen(true);
          }}
        >
          <span className="text-xl leading-none">+</span>
        </IosIconButton>
      </div>

      {plaidEnabled && connection.phase === "empty" ? (
        <IosCard padding="lg" className="border-[var(--accent)]/25 bg-[var(--accent)]/10">
          <p className="text-[17px] font-semibold text-[var(--foreground)]">Connect Bank</p>
          <p className="mt-1 text-[13px] leading-snug text-[var(--text-muted)]">
            Link an institution to import balances and activity automatically.
          </p>
          <div className="mt-4">
            <BankSyncConnect buttonLabel="Connect Bank" inline />
          </div>
        </IosCard>
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

      {groups.map((group) => (
        <IosSection key={group.key} title={group.label}>
          <IosList>
            {group.items.map((account) => (
              <IosListRow
                key={account.id}
                title={account.nickname || account.name}
                subtitle={
                  [account.institution, maskLastFour(account.lastFour)]
                    .filter(Boolean)
                    .join(" · ") || (account.isPlaidLinked ? "Linked" : "Manual")
                }
                leading={
                  <IosAvatar
                    src={account.institutionLogoUrl}
                    fallback={(account.nickname || account.name).slice(0, 1).toUpperCase()}
                    tone={
                      account.type === "credit_card"
                        ? "danger"
                        : account.type === "investment" || account.type === "crypto"
                          ? "warning"
                          : "accent"
                    }
                  />
                }
                trailing={formatCurrency(account.balance)}
              />
            ))}
          </IosList>
        </IosSection>
      ))}

      {debts.some((debt) => debt.isPlaidLinked || debt.balance > 0) ? (
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
                  leading={
                    <IosAvatar
                      src={debt.institutionLogoUrl}
                      fallback={debt.name.slice(0, 1).toUpperCase()}
                      tone="danger"
                    />
                  }
                  trailing={formatCurrency(debt.balance)}
                  href="/debt"
                />
              ))}
          </IosList>
        </IosSection>
      ) : null}

      {connection.phase === "connected" ? (
        <IosCard padding="md" className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold text-[var(--foreground)]">
              Connected to {connection.activeConnections.length || 1} institution
              {(connection.activeConnections.length || 1) === 1 ? "" : "s"}
            </p>
            <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
              Synced {formatSyncLabel(latestSync)}
            </p>
          </div>
          <span className="flex size-8 items-center justify-center rounded-full bg-[var(--success-muted)] text-[var(--success)]">
            ✓
          </span>
        </IosCard>
      ) : null}

      <IosSection
        title="Recent"
        action={<IosLink href="/transactions">See All</IosLink>}
      >
        {recentTxns.length === 0 ? (
          <p className="px-0.5 text-[13px] text-[var(--text-muted)]">
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
              const label = transaction.notes || transaction.category;
              return (
                <IosListRow
                  key={transaction.id}
                  title={label}
                  subtitle={formatTransactionDate(transaction.date)}
                  leading={
                    <IosAvatar
                      fallback={label.slice(0, 1).toUpperCase()}
                      tone={signed >= 0 ? "success" : "muted"}
                    />
                  }
                  trailing={
                    <span
                      className={cn(
                        signed >= 0 ? "text-[var(--success)]" : "text-[var(--foreground)]",
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

      {connection.phase === "connected" || visibleAccounts.length > 0 ? (
        <div className="space-y-2 pt-1">
          <IosPrimaryButton
            onClick={() => {
              void triggerHaptic("light");
              setAddOpen(true);
            }}
          >
            + Add Account
          </IosPrimaryButton>
          {plaidEnabled ? (
            <div className="flex justify-center">
              <BankSyncConnect compact inline buttonLabel="Link another bank" />
            </div>
          ) : null}
          {connection.activeConnections[0] ? (
            <button
              type="button"
              disabled={isSyncing}
              className="mx-auto block min-h-11 text-[13px] font-semibold text-[var(--text-muted)] disabled:opacity-50"
              onClick={() => {
                void triggerHaptic("light");
                void syncBank(connection.activeConnections[0]!.id);
              }}
            >
              {isSyncing ? "Syncing…" : "Sync now"}
            </button>
          ) : null}
        </div>
      ) : null}

      <AddAccountModal isOpen={addOpen} onClose={() => setAddOpen(false)} />
    </IosScreen>
  );
}
