"use client";

import { useCallback, useMemo } from "react";
import {
  usePlaidLink,
  type PlaidLinkOnSuccessMetadata,
  type PlaidLinkOptions,
} from "react-plaid-link";
import {
  logPlaidLinkEvent,
  logPlaidLinkExit,
  logPlaidLinkSuccess,
} from "@/lib/plaid/linkLogging";

type UsePlaidLinkSessionOptions = {
  linkToken: string | null;
  receivedRedirectUri?: string | null;
  onLinked: (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => void | Promise<void>;
  onExitMessage?: (message: string | null, status?: string | null) => void;
};

export function usePlaidLinkSession({
  linkToken,
  receivedRedirectUri,
  onLinked,
  onExitMessage,
}: UsePlaidLinkSessionOptions) {
  const onSuccess = useCallback(
    (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
      logPlaidLinkSuccess(publicToken, metadata);
      void onLinked(publicToken, metadata);
    },
    [onLinked],
  );

  const onExit = useCallback<NonNullable<PlaidLinkOptions["onExit"]>>(
    (error, metadata) => {
      logPlaidLinkExit(error, metadata);

      const message =
        error?.display_message ||
        error?.error_message ||
        (metadata.status ? `Link exited (${metadata.status})` : null);

      onExitMessage?.(message, metadata.status);
    },
    [onExitMessage],
  );

  const onEvent = useCallback<NonNullable<PlaidLinkOptions["onEvent"]>>(
    (eventName, metadata) => {
      logPlaidLinkEvent(eventName, metadata);
    },
    [],
  );

  const config = useMemo<PlaidLinkOptions>(() => {
    const next: PlaidLinkOptions = {
      token: linkToken,
      onSuccess,
      onExit,
      onEvent,
    };

    if (receivedRedirectUri) {
      next.receivedRedirectUri = receivedRedirectUri;
    }

    return next;
  }, [linkToken, onEvent, onExit, onSuccess, receivedRedirectUri]);

  // react-plaid-link does not re-create the handler when receivedRedirectUri changes.
  const instanceKey = `${linkToken ?? "none"}:${receivedRedirectUri ?? "none"}`;

  return {
    instanceKey,
    ...usePlaidLink(config),
  };
}
