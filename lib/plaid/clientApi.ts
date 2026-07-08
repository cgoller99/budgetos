"use client";

import type { PlaidSyncResult } from "@/lib/plaid/types";
import {
  logPlaidClientRequest,
  logPlaidClientResponse,
} from "@/lib/plaid/linkLogging";

type ApiErrorBody = {
  error?: string;
  code?: string;
  error_type?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  display_message?: string | null;
  request_id?: string | null;
};

function formatApiError(body: ApiErrorBody, status: number): string {
  const message =
    body.display_message ||
    body.error ||
    body.error_message ||
    "Plaid request failed.";

  const details = [
    body.code ? `code=${body.code}` : null,
    body.error_code ? `error_code=${body.error_code}` : null,
    body.error_type ? `error_type=${body.error_type}` : null,
    body.request_id ? `request_id=${body.request_id}` : null,
    `HTTP ${status}`,
  ]
    .filter(Boolean)
    .join(" | ");

  return `${message} (${details})`;
}

async function parseApiResponse<T>(
  response: Response,
  path: "/api/plaid/link-token" | "/api/plaid/exchange" | "/api/plaid/sync",
): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & ApiErrorBody;
  logPlaidClientResponse(path, response, body as Record<string, unknown>);

  if (!response.ok) {
    throw new Error(formatApiError(body, response.status));
  }

  return body;
}

export async function fetchPlaidLinkToken(input?: {
  connectionId?: string;
  mode?: "create" | "update";
}): Promise<string> {
  logPlaidClientRequest("/api/plaid/link-token", {
    mode: input?.mode ?? "create",
    connectionId: input?.connectionId ?? null,
  });

  const response = await fetch("/api/plaid/link-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input ?? {}),
  });
  const body = await parseApiResponse<{ linkToken: string; redirectUri?: string }>(
    response,
    "/api/plaid/link-token",
  );

  if (body.redirectUri) {
    console.info("[plaid/client] link-token redirectUri", body.redirectUri);
  }

  return body.linkToken;
}

export async function exchangePlaidPublicToken(publicToken: string): Promise<{
  connectionId: string;
  institutionName: string | null;
  sync?: PlaidSyncResult;
  syncError?: string;
}> {
  logPlaidClientRequest("/api/plaid/exchange", {
    publicTokenPrefix: `${publicToken.slice(0, 12)}…`,
  });

  const response = await fetch("/api/plaid/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicToken }),
  });
  return parseApiResponse(response, "/api/plaid/exchange");
}

export async function syncPlaidBank(connectionId?: string): Promise<PlaidSyncResult[]> {
  const response = await fetch("/api/plaid/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connectionId }),
  });
  const body = await parseApiResponse<{ results: PlaidSyncResult[] }>(response, "/api/plaid/sync");
  return body.results;
}

export async function disconnectPlaidBank(connectionId: string): Promise<void> {
  const response = await fetch("/api/plaid/disconnect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connectionId }),
  });
  await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Disconnect failed (HTTP ${response.status})`);
  }
}

export async function dismissPlaidRecurringSuggestion(
  merchantKey: string,
): Promise<void> {
  const response = await fetch("/api/plaid/dismiss-recurring", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ merchantKey }),
  });
  await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Dismiss failed (HTTP ${response.status})`);
  }
}

export function isPlaidReconnectRequired(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("ITEM_LOGIN_REQUIRED") ||
      error.message.toLowerCase().includes("reconnect"))
  );
}

export function isPlaidOAuthMisconfigurationExit(
  error: unknown,
  status: string | null,
): boolean {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return (
    message.includes("oauth") ||
    message.includes("redirect_uri") ||
    message.includes("invalid_link_token") ||
    message.includes("invalid link token") ||
    status === "requires_oauth" ||
    status === "oauth"
  );
}
