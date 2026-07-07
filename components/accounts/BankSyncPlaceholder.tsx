"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlaidLinkOnSuccessMetadata } from "react-plaid-link";
import { Badge, Button, Card, CardContent, CardHeader } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { usePlaidLinkSession } from "@/hooks/usePlaidLinkSession";
import { bankSyncComingSoonMessage } from "@/lib/integrations/bankSync";
import {
  exchangePlaidPublicToken,
  isPlaidOAuthMisconfigurationExit,
  isPlaidReconnectRequired,
} from "@/lib/plaid/clientApi";
import { isPlaidClientEnabled } from "@/lib/plaid/clientConfig";
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
}: BankSyncConnectProps) {
  const { connectBank, reconnectBank, isSyncing } = useFinance();
  const { showToast } = useToast();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [autoOpenLink, setAutoOpenLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plaidEnabled = isPlaidClientEnabled();
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
    } finally {
      setIsLoadingToken(false);
    }
  }, [connectionId, connectBank, mode, reconnectBank]);

  const handleLinked = useCallback(
    async (publicToken: string) => {
      try {
        const result = await exchangePlaidPublicToken(publicToken);
        clearStoredPlaidLinkToken();
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
      } catch (successError) {
        const message =
          successError instanceof Error
            ? successError.message
            : "Unable to finish bank connection.";
        setError(message);
        showToast({
          title: "Connection failed",
          subtitle: message,
        });
      } finally {
        setLinkToken(null);
        setAutoOpenLink(false);
      }
    },
    [showToast],
  );

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

  if (!plaidEnabled) {
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
            compact={compact}
            disabled={isSyncing}
            onPrepare={loadLinkToken}
            isPreparing={isLoadingToken}
            autoOpen={autoOpenLink}
          />
          {linkToken && (
            <Button
              variant="secondary"
              size={compact ? "sm" : "md"}
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
      </CardContent>
    </Card>
  );
}

export function BankSyncPlaceholder() {
  return <BankSyncConnect />;
}
