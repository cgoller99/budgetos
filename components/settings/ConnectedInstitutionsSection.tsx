"use client";

import { useMemo, useState } from "react";
import { BankSyncConnect } from "@/components/accounts/BankSyncPlaceholder";
import { Badge, Button, Card, CardContent, CardHeader } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency } from "@/lib/finance/format";
import type { Account, BankConnection } from "@/lib/finance/types";
import { isPlaidClientEnabled } from "@/lib/plaid/clientConfig";

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

function ConnectionAccounts({
  accounts,
}: {
  accounts: Account[];
}) {
  if (accounts.length === 0) {
    return (
      <p className="text-sm text-white/45">No linked accounts synced yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {accounts.map((account) => (
        <div
          key={account.id}
          className="flex items-start justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3"
        >
          <div className="flex items-start gap-3">
            {account.institutionLogoUrl ? (
              <img
                src={account.institutionLogoUrl}
                alt=""
                className="mt-0.5 h-8 w-8 rounded-lg bg-white/10 object-contain p-1"
              />
            ) : (
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-[#0077ed]/20 text-sm">
                🏦
              </div>
            )}
            <div>
              <p className="font-medium text-white">{account.name}</p>
              <p className="text-sm text-white/45">
                {account.institution}
                {account.lastFour ? ` •••• ${account.lastFour}` : ""}
              </p>
              <p className="text-xs text-white/35">
                {account.type.replace("_", " ")} • Last synced{" "}
                {formatSyncTime(account.lastSyncedAt)}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-medium text-white">
              {formatCurrency(account.balance)}
            </p>
            {account.availableBalance !== null &&
              account.availableBalance !== undefined && (
                <p className="text-xs text-white/45">
                  {formatCurrency(account.availableBalance)} available
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
  accounts,
  onSync,
  onDisconnect,
  isSyncing,
}: {
  connection: BankConnection;
  accounts: Account[];
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
        <div className="flex items-center gap-3">
          {connection.institutionLogoUrl ? (
            <img
              src={connection.institutionLogoUrl}
              alt=""
              className="h-10 w-10 rounded-xl bg-white/10 object-contain p-1"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0077ed]/20 text-lg">
              🏦
            </div>
          )}
          <div>
            <p className="text-sm text-white/55">
              Last sync: {formatSyncTime(connection.lastSyncedAt)}
            </p>
            {connection.errorMessage && (
              <p className="text-sm text-amber-300">{connection.errorMessage}</p>
            )}
          </div>
        </div>

        <ConnectionAccounts accounts={accounts} />

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={isSyncing}
            onClick={() => void onSync(connection.id)}
          >
            {isSyncing ? "Syncing..." : "Sync now"}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setShowReconnect((value) => !value)}
          >
            Reconnect
          </Button>
          <Button
            size="sm"
            variant="secondary"
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
    syncBank,
    disconnectBank,
    isSyncing,
  } = useFinance();
  const { showToast } = useToast();
  const plaidEnabled = isPlaidClientEnabled();

  const accountsByConnection = useMemo(() => {
    const grouped = new Map<string, Account[]>();

    for (const account of accounts) {
      if (!account.bankConnectionId) {
        continue;
      }

      const existing = grouped.get(account.bankConnectionId) ?? [];
      existing.push(account);
      grouped.set(account.bankConnectionId, existing);
    }

    return grouped;
  }, [accounts]);

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
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Connected institutions</h2>
        <p className="text-sm text-white/45">
          Manage linked banks, manual sync, and reconnect when credentials expire.
        </p>
      </div>

      {activeConnections.length === 0 ? (
        <BankSyncConnect />
      ) : (
        <div className="space-y-4">
          {activeConnections.map((connection) => (
            <ConnectedInstitutionCard
              key={connection.id}
              connection={connection}
              accounts={accountsByConnection.get(connection.id) ?? []}
              onSync={handleSync}
              onDisconnect={handleDisconnect}
              isSyncing={isSyncing}
            />
          ))}
          <BankSyncConnect buttonLabel="Connect another bank" compact />
        </div>
      )}
    </section>
  );
}
