"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlaidLinkOnSuccessMetadata } from "react-plaid-link";
import { Button } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { usePlaidLinkSession } from "@/hooks/usePlaidLinkSession";
import { bankSyncComingSoonMessage } from "@/lib/integrations/bankSync";
import {
  exchangePlaidPublicToken,
  isPlaidOAuthMisconfigurationExit,
} from "@/lib/plaid/clientApi";
import { isPlaidClientEnabled } from "@/lib/plaid/clientConfig";
import {
  clearStoredPlaidLinkToken,
  clearStoredPlaidReturnPath,
  isPlaidOAuthHandoffExit,
  storePlaidLinkToken,
  storePlaidReturnPath,
} from "@/lib/plaid/oauth";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics/client";

type OnboardingPlaidConnectProps = {
  onConnected: () => void | Promise<void>;
  onSkip: () => void | Promise<void>;
  isSubmitting?: boolean;
};

function OnboardingPlaidLinkButton({
  linkToken,
  onLinked,
  onExitMessage,
  disabled,
  onPrepare,
  isPreparing,
  autoOpen,
}: {
  linkToken: string | null;
  onLinked: (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => void | Promise<void>;
  onExitMessage?: (message: string | null, status?: string | null) => void;
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

  return (
    <Button
      className="w-full min-h-14 text-base font-semibold sm:min-h-16 sm:text-lg"
      size="lg"
      disabled={disabled || isPreparing || (Boolean(linkToken) && !ready)}
      onClick={() => void (linkToken ? open() : onPrepare())}
    >
      {isPreparing ? "Loading..." : "Connect Bank"}
    </Button>
  );
}

export function OnboardingPlaidConnect({
  onConnected,
  onSkip,
  isSubmitting = false,
}: OnboardingPlaidConnectProps) {
  const { connectBank, isSyncing, refreshFinance } = useFinance();
  const { showToast } = useToast();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const [autoOpenLink, setAutoOpenLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plaidEnabled = isPlaidClientEnabled();

  const loadLinkToken = useCallback(async () => {
    setIsLoadingToken(true);
    setError(null);

    try {
      storePlaidReturnPath("/onboarding?plaid=resume");
      const token = await connectBank();
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
        mode: "create",
        source: "onboarding",
      });
    } finally {
      setIsLoadingToken(false);
    }
  }, [connectBank]);

  const handleLinked = useCallback(
    async (publicToken: string) => {
      try {
        const result = await exchangePlaidPublicToken(publicToken);
        clearStoredPlaidLinkToken();
        clearStoredPlaidReturnPath();
        trackEvent(ANALYTICS_EVENTS.CONNECTED_PLAID, {
          institution: result.institutionName ?? "unknown",
          source: "onboarding",
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

        await refreshFinance({ openRecurringBillsModal: true });
        await onConnected();
      } catch (successError) {
        const message =
          successError instanceof Error
            ? successError.message
            : "Unable to finish bank connection.";
        setError(message);
        trackEvent(ANALYTICS_EVENTS.PLAID_CONNECTION_FAILED, {
          stage: "exchange",
          mode: "create",
          source: "onboarding",
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
    [onConnected, refreshFinance, showToast],
  );

  const handleExitMessage = useCallback((message: string | null, status?: string | null) => {
    if (message) {
      if (isPlaidOAuthMisconfigurationExit(new Error(message), status ?? null)) {
        setError(`${message} Register https://buxme.co/oauth/plaid in Plaid Dashboard → Allowed redirect URIs.`);
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
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-white/55">{bankSyncComingSoonMessage}</p>
        <p className="text-sm text-white/45">
          Plaid is not enabled in this environment yet. You can skip for now and connect later from
          Accounts.
        </p>
        <Button
          className="w-full"
          variant="secondary"
          size="lg"
          disabled={isSubmitting}
          onClick={() => void onSkip()}
        >
          Skip for Now
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-2 text-sm text-white/50">
        <li>Automatically imports accounts, balances, and transactions</li>
        <li>Fastest way to get started</li>
        <li>You can add manual accounts later anytime</li>
      </ul>

      {error ? <p className="text-sm text-amber-300">{error}</p> : null}

      <div className="space-y-3">
        <OnboardingPlaidLinkButton
          linkToken={linkToken}
          onLinked={(publicToken) => void handleLinked(publicToken)}
          onExitMessage={handleExitMessage}
          disabled={isSubmitting || isSyncing}
          onPrepare={loadLinkToken}
          isPreparing={isLoadingToken}
          autoOpen={autoOpenLink}
        />
        <Button
          className="w-full"
          variant="secondary"
          size="lg"
          disabled={isSubmitting || isSyncing || isLoadingToken}
          onClick={() => void onSkip()}
        >
          Skip for Now
        </Button>
      </div>
    </div>
  );
}
