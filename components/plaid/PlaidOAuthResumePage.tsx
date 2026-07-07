"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { useToast } from "@/context/ToastContext";
import { usePlaidLinkSession } from "@/hooks/usePlaidLinkSession";
import {
  exchangePlaidPublicToken,
  isPlaidOAuthMisconfigurationExit,
} from "@/lib/plaid/clientApi";
import {
  clearStoredPlaidLinkToken,
  getPlaidOAuthRedirectUri,
  isPlaidOAuthReturn,
  readStoredPlaidLinkToken,
} from "@/lib/plaid/oauth";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics/client";

export function PlaidOAuthResumePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [receivedRedirectUri, setReceivedRedirectUri] = useState<string | null>(null);
  const [oauthReturn, setOauthReturn] = useState(false);

  useEffect(() => {
    const href = window.location.href;
    setOauthReturn(isPlaidOAuthReturn(href));
    setLinkToken(readStoredPlaidLinkToken());
    setReceivedRedirectUri(href);
  }, []);

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

        router.replace("/accounts");
      } catch (exchangeError) {
        const message =
          exchangeError instanceof Error
            ? exchangeError.message
            : "Unable to finish bank connection.";
        setError(message);
        showToast({
          title: "Connection failed",
          subtitle: message,
        });
      }
    },
    [router, showToast],
  );

  const handleExitMessage = useCallback(
    (message: string | null) => {
      if (!message) {
        router.replace("/accounts");
        return;
      }

      setError(message);
    },
    [router],
  );

  const { open, ready } = usePlaidLinkSession({
    linkToken,
    receivedRedirectUri,
    onLinked: (publicToken) => handleLinked(publicToken),
    onExitMessage: handleExitMessage,
  });

  useEffect(() => {
    if (!oauthReturn) {
      setError("Missing Plaid OAuth state. Start bank connection from Accounts again.");
      return;
    }

    if (!linkToken) {
      setError("Missing Plaid link token. Start bank connection from Accounts again.");
      return;
    }

    if (ready) {
      open();
    }
  }, [linkToken, oauthReturn, open, ready]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg items-center py-16">
      <Card padding="lg" className="w-full">
        <CardHeader title="Finishing bank connection" />
        <CardContent className="space-y-3 text-sm text-white/60">
          {error ? (
            <p className="text-amber-300">{error}</p>
          ) : (
            <p>Resuming Plaid Link after bank sign-in…</p>
          )}
          {error && isPlaidOAuthMisconfigurationExit(new Error(error), null) && (
            <p>
              Register <code className="text-white/80">{getPlaidOAuthRedirectUri()}</code> in Plaid
              Dashboard → Allowed redirect URIs.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
