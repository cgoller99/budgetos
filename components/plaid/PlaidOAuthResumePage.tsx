"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { useToast } from "@/context/ToastContext";
import { usePlaidLinkSession } from "@/hooks/usePlaidLinkSession";
import {
  exchangePlaidPublicToken,
  isPlaidOAuthMisconfigurationExit,
} from "@/lib/plaid/clientApi";
import {
  clearStoredPlaidLinkToken,
  clearStoredPlaidReturnPath,
  isPlaidOAuthReturn,
  readStoredPlaidLinkToken,
  readStoredPlaidReturnPath,
  PLAID_PRODUCTION_OAUTH_REDIRECT_URI,
} from "@/lib/plaid/oauth";
import { ANALYTICS_EVENTS, trackEvent } from "@/lib/analytics/client";

type OAuthBootstrap = {
  oauthReturn: boolean;
  linkToken: string | null;
  receivedRedirectUri: string | null;
};

function readOAuthBootstrap(): OAuthBootstrap {
  const href = window.location.href;
  const oauthReturn = isPlaidOAuthReturn(href);

  return {
    oauthReturn,
    linkToken: oauthReturn ? readStoredPlaidLinkToken() : null,
    receivedRedirectUri: oauthReturn ? href : null,
  };
}

function PlaidOAuthResumeInner({
  bootstrap,
}: {
  bootstrap: OAuthBootstrap;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const { refreshFinance } = useFinance();
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);

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

        await refreshFinance();
        const returnPath = readStoredPlaidReturnPath();
        clearStoredPlaidReturnPath();
        router.replace(returnPath ?? "/accounts");
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
    [refreshFinance, router, showToast],
  );

  const handleExitMessage = useCallback(
    (message: string | null, status?: string | null) => {
      if (!message) {
        router.replace("/accounts");
        return;
      }

      setError(
        isPlaidOAuthMisconfigurationExit(new Error(message), status ?? null)
          ? `${message} Register ${PLAID_PRODUCTION_OAUTH_REDIRECT_URI} in Plaid Dashboard → Allowed redirect URIs.`
          : message,
      );
    },
    [router],
  );

  const { open, ready } = usePlaidLinkSession({
    linkToken: bootstrap.linkToken,
    receivedRedirectUri: bootstrap.receivedRedirectUri,
    onLinked: (publicToken) => handleLinked(publicToken),
    onExitMessage: handleExitMessage,
  });

  useEffect(() => {
    if (!bootstrap.oauthReturn) {
      setError("Missing Plaid OAuth state. Start bank connection from Accounts again.");
      return;
    }

    if (!bootstrap.linkToken) {
      setError("Missing Plaid link token. Start bank connection from Accounts again.");
      return;
    }

    if (ready && !opened) {
      setOpened(true);
      open();
    }
  }, [bootstrap.linkToken, bootstrap.oauthReturn, open, opened, ready]);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center px-6 py-16">
      <Card padding="lg" className="w-full">
        <CardHeader title="Finishing bank connection" />
        <CardContent className="space-y-3 text-sm text-white/60">
          {error ? (
            <p className="text-amber-300">{error}</p>
          ) : (
            <p>Resuming Plaid Link after bank sign-in…</p>
          )}
          {error && (
            <Link href="/accounts" className="inline-block text-sm text-[var(--accent-light)] hover:underline">
              Back to Accounts
            </Link>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function PlaidOAuthResumePage() {
  const [bootstrap, setBootstrap] = useState<OAuthBootstrap | null>(null);

  useEffect(() => {
    setBootstrap(readOAuthBootstrap());
  }, []);

  if (!bootstrap) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--accent)]/30" />
      </div>
    );
  }

  return <PlaidOAuthResumeInner bootstrap={bootstrap} />;
}
