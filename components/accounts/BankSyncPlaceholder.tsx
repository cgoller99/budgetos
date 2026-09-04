"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { PlaidLinkOnSuccessMetadata } from "react-plaid-link";
import { Badge, Button, Card, CardContent, CardHeader } from "@/components/ui";
import { ManualAccountsPlaidMergeModal } from "@/components/plaid/ManualAccountsPlaidMergeModal";
import { clearPlaidConnectBannerDismissal } from "@/components/guidance/PlaidConnectBanner";
import { useFinance } from "@/context/FinanceContext";
import { useSubscription } from "@/context/SubscriptionContext";
import { useToast } from "@/context/ToastContext";
import { usePlaidLinkSession } from "@/hooks/usePlaidLinkSession";
import { bankSyncComingSoonMessage } from "@/lib/integrations/bankSync";
import { getManualAccounts } from "@/lib/onboarding/progress";
import {
  exchangePlaidPublicToken,
  isPlaidOAuthMisconfigurationExit,
  isPlaidReconnectRequired,
} from "@/lib/plaid/clientApi";
import { isPlaidClientEnabled } from "@/lib/plaid/clientConfig";
import { PLAID_PRO_REQUIRED_MESSAGE } from "@/lib/plaid/plaidEntitlementGate";
import {
  storePlaidLinkToken,
  clearStoredPlaidLinkToken,
  isPlaidOAuthHandoffExit,
} from "@/lib/plaid/oauth";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics/client";

type BankSyncConnectProps = {
  connectionId?: string;
  mode?: "create" | "update";
  buttonLabel?: string;
  compact?: boolean;
  /** Button + error only (no card chrome) — for native inline actions. */
  inline?: boolean;
};

function BankSyncLinkButton({
  linkToken,
  onLinked,
  onExitMessage,
  buttonLabel,
  compact,
  disabled,
  onPrepare,
  isPreparing,
  autoOpen,
}: {
  linkToken: string | null;
  onLinked: (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => void | Promise<void>;
  onExitMessage?: (message: string | null, status?: string | null) => void;
  buttonLabel: string;
  compact?: boolean;
  disabled?: boolean;
  onPrepare: () => Promise<void>;
  isPreparing: boolean;
  autoOpen: boolean;
}) {
  const { open, ready } = usePlaidLinkSession({
    linkToken,
    onLinked,
    onExitMessage,
  });

  useEffect(() => {
    if (autoOpen && linkToken && ready) {
      open();
    }
  }, [autoOpen, linkToken, open, ready]);

  const handleClick = async () => {
    if (!linkToken) {
      await onPrepare();
      return;
    }

    open();
  };

  return (
    <Button
      size={compact ? "sm" : "md"}
      disabled={disabled || isPreparing || (Boolean(linkToken) && !ready)}
      onClick={() => void handleClick()}
    >
      {isPreparing ? "Loading..." : buttonLabel}
    </Button>
  );
}

export function BankSyncConnect({
  connectionId,
  mode = "create",
  buttonLabel,
  compact = false,
  inline = false,
}: BankSyncConnectProps) {
  const { connectBank, reconnectBank, isSyncing, refreshFinance, deleteAccount, accounts } =
    useFinance();
  const { hasProAccess, isFounder } = useSubscription();
  const { showToast } = useToast();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [autoOpenLink, setAutoOpenLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [manualAccountsBeforeConnect, setManualAccountsBeforeConnect] = useState<
    typeof accounts
  >([]);
  const [plaidAccountCount, setPlaidAccountCount] = useState(0);
  const [isRemovingManual, setIsRemovingManual] = useState(false);
  const plaidEnabled = isPlaidClientEnabled();
  const canCreatePlaid = hasProAccess || isFounder;
  const requiresUpgrade = mode === "create" && !canCreatePlaid;
  const label =
    buttonLabel ??
    (mode === "update" ? "Reconnect bank" : "Connect bank");

  const loadLinkToken = useCallback(async () => {
    setIsLoadingToken(true);
    setError(null);

    try {
      const token =
        mode === "update" && connectionId
          ? await reconnectBank(connectionId)
          : await connectBank();
      storePlaidLinkToken(token);
      setLinkToken(token);
      setAutoOpenLink(true);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Unable to start bank connection.";
      setError(message);
      trackEvent(ANALYTICS_EVENTS.PLAID_CONNECTION_FAILED, {
        stage: "link_token",
        mode,
      });
    } finally {
      setIsLoadingToken(false);
    }
  }, [connectionId, connectBank, mode, reconnectBank]);

  const handleLinked = useCallback(
    async (publicToken: string) => {
      const manualBeforeConnect = getManualAccounts(accounts);

      try {
        const result = await exchangePlaidPublicToken(publicToken);
        clearStoredPlaidLinkToken();
        clearPlaidConnectBannerDismissal();
        trackEvent(ANALYTICS_EVENTS.CONNECTED_PLAID, {
          institution: result.institutionName ?? "unknown",
        });
        showToast({
          title: "Bank connected",
          subtitle: result.institutionName ?? "Your accounts are syncing.",
        });

        if (result.syncError) {
          showToast({
            title: "Sync needs attention",
            subtitle: result.syncError,
          });
        }

        const refreshed = await refreshFinance({ openRecurringBillsModal: true });

        if (mode === "create" && manualBeforeConnect.length > 0 && refreshed) {
          const importedCount = refreshed.accounts.filter((account) => account.bankConnectionId)
            .length;
          setManualAccountsBeforeConnect(manualBeforeConnect);
          setPlaidAccountCount(Math.max(importedCount, 1));
          setMergeModalOpen(true);
        }
      } catch (successError) {
        const message =
          successError instanceof Error
            ? successError.message
            : "Unable to finish bank connection.";
        setError(message);
        trackEvent(ANALYTICS_EVENTS.PLAID_CONNECTION_FAILED, {
          stage: "exchange",
          mode,
        });
        showToast({
          title: "Connection failed",
          subtitle: message,
        });
      } finally {
        setLinkToken(null);
        setAutoOpenLink(false);
      }
    },
    [accounts, mode, refreshFinance, showToast],
  );

  const handleKeepManualAccounts = useCallback(() => {
    setMergeModalOpen(false);
    setManualAccountsBeforeConnect([]);
  }, []);

  const handleRemoveManualAccounts = useCallback(async () => {
    setIsRemovingManual(true);

    try {
      for (const account of manualAccountsBeforeConnect) {
        await deleteAccount(account.id, { deleteTransactions: true });
      }
      showToast({
        title: "Manual accounts removed",
        subtitle: "Your Plaid accounts are ready to use.",
      });
      setMergeModalOpen(false);
      setManualAccountsBeforeConnect([]);
    } catch (removeError) {
      const message =
        removeError instanceof Error
          ? removeError.message
          : "Unable to remove manual accounts.";
      showToast({
        title: "Could not remove accounts",
        subtitle: message,
        type: "error",
      });
    } finally {
      setIsRemovingManual(false);
    }
  }, [deleteAccount, manualAccountsBeforeConnect, showToast]);

  const handleExitMessage = useCallback((message: string | null, status?: string | null) => {
    if (message) {
      if (isPlaidOAuthMisconfigurationExit(new Error(message), status ?? null)) {
        setError(
          `${message} Register https://buxme.co/oauth/plaid in Plaid Dashboard → Allowed redirect URIs.`,
        );
      } else {
        setError(message);
      }
    }

    if (!isPlaidOAuthHandoffExit(status)) {
      setLinkToken(null);
      setAutoOpenLink(false);
    }
  }, []);

  const actions = (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-amber-300">
          {error}
          {isPlaidReconnectRequired({ message: error }) ? " Try reconnecting." : ""}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <BankSyncLinkButton
          linkToken={linkToken}
          onLinked={(publicToken) => void handleLinked(publicToken)}
          onExitMessage={handleExitMessage}
          buttonLabel={isSyncing ? "Syncing..." : label}
          compact={compact || inline}
          disabled={isSyncing}
          onPrepare={loadLinkToken}
          isPreparing={isLoadingToken}
          autoOpen={autoOpenLink}
        />
        {linkToken && (
          <Button
            variant="secondary"
            size={compact || inline ? "sm" : "md"}
            disabled={isLoadingToken}
            onClick={() => {
              setLinkToken(null);
              setAutoOpenLink(false);
              clearStoredPlaidLinkToken();
            }}
          >
            Reset link
          </Button>
        )}
      </div>
    </div>
  );

  const mergeModal = (
    <ManualAccountsPlaidMergeModal
      isOpen={mergeModalOpen}
      manualAccounts={manualAccountsBeforeConnect}
      plaidAccountCount={plaidAccountCount}
      isPending={isRemovingManual}
      onKeepManual={handleKeepManualAccounts}
      onRemoveManual={handleRemoveManualAccounts}
    />
  );

  if (!plaidEnabled) {
    if (inline) {
      return (
        <p className="text-sm text-white/45">
          Bank linking isn’t configured in this build.
        </p>
      );
    }

    return (
      <Card padding="lg">
        <CardHeader
          title="Connect bank"
          action={<Badge variant="warning">Setup required</Badge>}
        />
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-white/55">
            {bankSyncComingSoonMessage}
          </p>
          <p className="text-sm text-white/45">
            Add Plaid credentials to `.env.local` and set
            `NEXT_PUBLIC_PLAID_ENABLED=true`.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (requiresUpgrade) {
    if (inline) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-white/55">{PLAID_PRO_REQUIRED_MESSAGE}</p>
          <Link href="/settings?upgrade=pro#billing">
            <Button size="sm" className="touch-manipulation">
              Upgrade to Pro
            </Button>
          </Link>
        </div>
      );
    }

    return (
      <Card padding="lg">
        <CardHeader
          title="Connect bank"
          action={<Badge variant="accent">Pro</Badge>}
        />
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-white/55">
            {PLAID_PRO_REQUIRED_MESSAGE} Existing linked banks keep syncing if you
            already connected them.
          </p>
          <Link href="/settings?upgrade=pro#billing">
            <Button size="md">Upgrade to Pro</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (inline) {
    return (
      <>
        {actions}
        {mergeModal}
      </>
    );
  }

  return (
    <Card padding="lg">
      <CardHeader
        title={mode === "update" ? "Reconnect bank" : "Connect bank"}
        action={<Badge variant="accent">Plaid</Badge>}
      />
      <CardContent className="space-y-4">
        <p className="text-sm leading-relaxed text-white/55">
          {bankSyncComingSoonMessage}
        </p>
        <ul className="space-y-2 text-sm text-white/45">
          <li>Automatically import account balances</li>
          <li>Sync transactions into Buxme</li>
          <li>Keep manual entry available at any time</li>
        </ul>
        {actions}
      </CardContent>
      {mergeModal}
    </Card>
  );
}

export function BankSyncPlaceholder() {
  return <BankSyncConnect />;
}
