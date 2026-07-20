"use client";

import { useMemo, useState } from "react";
import { BankSyncConnect } from "@/components/accounts/BankSyncPlaceholder";
import { Badge, Button, Card, CardContent, CardHeader } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { DEBT_ACCOUNT_TYPE_LABELS } from "@/lib/finance/debts";
import { formatCurrency } from "@/lib/finance/format";
import type { Account, BankConnection, Debt } from "@/lib/finance/types";
import { isPlaidClientEnabled } from "@/lib/plaid/clientConfig";

type LinkedAccountItem = {
  id: string;
  name: string;
  institution: string;
  typeLabel: string;
  balance: number;
  availableBalance?: number | null;
  lastFour?: string | null;
  institutionLogoUrl?: string | null;
  lastSyncedAt?: string | null;
  isDebt?: boolean;
};

function formatSyncTime(value: string | null | undefined): string {
  if (!value) {
    return "Never synced";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Never synced";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function toLinkedAccountItem(account: Account): LinkedAccountItem {
  return {
    id: account.id,
    name: account.name,
    institution: account.institution,
    typeLabel: account.type.replace("_", " "),
    balance: account.balance,
    availableBalance: account.availableBalance,
    lastFour: account.lastFour,
    institutionLogoUrl: account.institutionLogoUrl,
    lastSyncedAt: account.lastSyncedAt,
  };
}

function toLinkedDebtItem(debt: Debt): LinkedAccountItem {
  return {
    id: debt.id,
    name: debt.name,
    institution: debt.institution ?? "",
    typeLabel: DEBT_ACCOUNT_TYPE_LABELS[debt.accountType],
    balance: debt.balance,
    lastFour: debt.lastFour,
    institutionLogoUrl: debt.institutionLogoUrl,
    lastSyncedAt: debt.lastSyncedAt,
    isDebt: true,
  };
}

function ConnectionAccounts({
  items,
}: {
  items: LinkedAccountItem[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-white/45">No linked accounts synced yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-start justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3"
        >
          <div className="flex min-w-0 items-start gap-3">
            {item.institutionLogoUrl ? (
              <img
                src={item.institutionLogoUrl}
                alt=""
                className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-white/10 object-contain p-1"
              />
            ) : (
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/20 text-sm">
                {item.isDebt ? "💳" : "🏦"}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-medium text-white">{item.name}</p>
              <p className="truncate text-sm text-white/45">
                {item.institution || "Linked institution"}
                {item.lastFour ? ` •••• ${item.lastFour}` : ""}
              </p>
              <p className="text-xs text-white/35">
                {item.typeLabel}
                {item.lastSyncedAt
                  ? ` • Last synced ${formatSyncTime(item.lastSyncedAt)}`
                  : ""}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-medium text-white">
              {formatCurrency(item.balance)}
            </p>
            {!item.isDebt &&
              item.availableBalance !== null &&
              item.availableBalance !== undefined && (
                <p className="text-xs text-white/45">
                  {formatCurrency(item.availableBalance)} available
                </p>
              )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ConnectedInstitutionCard({
  connection,
  items,
  onSync,
  onDisconnect,
  isSyncing,
}: {
  connection: BankConnection;
  items: LinkedAccountItem[];
  onSync: (connectionId: string) => Promise<void>;
  onDisconnect: (connectionId: string) => Promise<void>;
  isSyncing: boolean;
}) {
  const [showReconnect, setShowReconnect] = useState(false);
  const statusVariant =
    connection.status === "connected"
      ? "success"
      : connection.status === "error"
        ? "warning"
        : "default";

  return (
    <Card padding="lg">
      <CardHeader
        title={connection.institutionName ?? "Linked institution"}
        action={
          <Badge variant={statusVariant}>
            {connection.status === "error" ? "Reconnect needed" : connection.status}
          </Badge>
        }
      />
      <CardContent className="space-y-4">
        <p className="text-sm text-white/45">
          Last synced {formatSyncTime(connection.lastSyncedAt)}
        </p>
        {connection.errorMessage && (
          <p className="text-sm text-amber-300">{connection.errorMessage}</p>
        )}
        <ConnectionAccounts items={items} />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={isSyncing}
            onClick={() => void onSync(connection.id)}
          >
            {isSyncing ? "Syncing..." : "Sync now"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={isSyncing}
            onClick={() => setShowReconnect((value) => !value)}
          >
            Reconnect
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={isSyncing}
            onClick={() => void onDisconnect(connection.id)}
          >
            Disconnect
          </Button>
        </div>
        {showReconnect && (
          <BankSyncConnect
            connectionId={connection.id}
            mode="update"
            compact
            buttonLabel="Launch Plaid Link"
          />
        )}
      </CardContent>
    </Card>
  );
}

export function ConnectedInstitutionsSection() {
  const {
    bankConnections,
    accounts,
    debts,
    syncBank,
    disconnectBank,
    isSyncing,
  } = useFinance();
  const { showToast } = useToast();
  const plaidEnabled = isPlaidClientEnabled();

  const itemsByConnection = useMemo(() => {
    const grouped = new Map<string, LinkedAccountItem[]>();

    for (const account of accounts) {
      if (!account.bankConnectionId) {
        continue;
      }

      const existing = grouped.get(account.bankConnectionId) ?? [];
      existing.push(toLinkedAccountItem(account));
      grouped.set(account.bankConnectionId, existing);
    }

    for (const debt of debts) {
      if (!debt.bankConnectionId) {
        continue;
      }

      const existing = grouped.get(debt.bankConnectionId) ?? [];
      existing.push(toLinkedDebtItem(debt));
      grouped.set(debt.bankConnectionId, existing);
    }

    return grouped;
  }, [accounts, debts]);

  const activeConnections = bankConnections.filter(
    (connection) => connection.status !== "disconnected",
  );

  const handleSync = async (connectionId: string) => {
    try {
      await syncBank(connectionId);
      showToast({
        title: "Bank sync complete",
        subtitle: "Balances and transactions were refreshed.",
      });
    } catch (error) {
      showToast({
        title: "Sync failed",
        subtitle: error instanceof Error ? error.message : "Try reconnecting.",
      });
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    try {
      await disconnectBank(connectionId);
      showToast({
        title: "Bank disconnected",
        subtitle: "Linked accounts were removed from sync.",
      });
    } catch (error) {
      showToast({
        title: "Disconnect failed",
        subtitle: error instanceof Error ? error.message : "Try again.",
      });
    }
  };

  if (!plaidEnabled) {
    return null;
  }

  return (
    <section id="connections" className="space-y-4 scroll-mt-24">
      <div>
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Connected institutions</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Linked checking, savings, credit, loan, and investment accounts from Plaid.
        </p>
      </div>

      {activeConnections.length === 0 ? (
        <BankSyncConnect />
      ) : (
        activeConnections.map((connection) => (
          <ConnectedInstitutionCard
            key={connection.id}
            connection={connection}
            items={itemsByConnection.get(connection.id) ?? []}
            onSync={handleSync}
            onDisconnect={handleDisconnect}
            isSyncing={isSyncing}
          />
        ))
      )}
    </section>
  );
}
