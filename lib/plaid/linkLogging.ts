"use client";

import type {
  PlaidLinkOnEventMetadata,
  PlaidLinkOnExitMetadata,
  PlaidLinkOnSuccessMetadata,
  PlaidLinkError,
} from "react-plaid-link";

export function logPlaidLinkSuccess(
  publicToken: string,
  metadata: PlaidLinkOnSuccessMetadata,
): void {
  console.info("[plaid/link] onSuccess", {
    publicTokenPrefix: `${publicToken.slice(0, 12)}…`,
    institution: metadata.institution?.name ?? null,
    institutionId: metadata.institution?.institution_id ?? null,
    accountCount: metadata.accounts.length,
    linkSessionId: metadata.link_session_id,
  });
}

export function logPlaidLinkExit(
  error: PlaidLinkError | null,
  metadata: PlaidLinkOnExitMetadata,
): void {
  console.warn("[plaid/link] onExit", {
    error_code: error?.error_code ?? null,
    error_message: error?.error_message ?? null,
    error_type: error?.error_type ?? null,
    display_message: error?.display_message ?? null,
    status: metadata.status,
    request_id: metadata.request_id,
    linkSessionId: metadata.link_session_id,
    institution: metadata.institution?.name ?? null,
  });
}

export function logPlaidLinkEvent(
  eventName: string,
  metadata: PlaidLinkOnEventMetadata,
): void {
  console.info("[plaid/link] onEvent", {
    eventName,
    view_name: metadata.view_name,
    error_code: metadata.error_code,
    error_message: metadata.error_message,
    exit_status: metadata.exit_status,
    institution_name: metadata.institution_name,
    request_id: metadata.request_id,
    linkSessionId: metadata.link_session_id,
  });
}

export function logPlaidClientRequest(
  path: "/api/plaid/link-token" | "/api/plaid/exchange" | "/api/plaid/sync",
  input: Record<string, unknown>,
): void {
  console.info(`[plaid/client] POST ${path}`, input);
}

export function logPlaidClientResponse(
  path: "/api/plaid/link-token" | "/api/plaid/exchange" | "/api/plaid/sync",
  response: Response,
  body: Record<string, unknown>,
): void {
  console.info(`[plaid/client] POST ${path} response`, {
    ok: response.ok,
    status: response.status,
    code: body.code ?? null,
    error: body.error ?? null,
    connectionId: body.connectionId ?? null,
    request_id: body.request_id ?? null,
  });
}
