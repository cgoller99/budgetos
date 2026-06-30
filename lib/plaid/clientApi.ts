"use client";

import type { PlaidSyncResult } from "@/lib/plaid/types";

type ApiErrorBody = {
  error?: string;
  code?: string;
};

async function parseApiResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & ApiErrorBody;

  if (!response.ok) {
    throw new Error(body.error ?? "Plaid request failed.");
  }

  return body;
}

export async function fetchPlaidLinkToken(input?: {
  connectionId?: string;
  mode?: "create" | "update";
}): Promise<string> {
  const response = await fetch("/api/plaid/link-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input ?? {}),
  });
  const body = await parseApiResponse<{ linkToken: string }>(response);
  return body.linkToken;
}

export async function exchangePlaidPublicToken(publicToken: string): Promise<{
  connectionId: string;
  institutionName: string | null;
  sync?: PlaidSyncResult;
  syncError?: string;
}> {
  const response = await fetch("/api/plaid/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicToken }),
  });
  return parseApiResponse(response);
}

export async function syncPlaidBank(connectionId?: string): Promise<PlaidSyncResult[]> {
  const response = await fetch("/api/plaid/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connectionId }),
  });
  const body = await parseApiResponse<{ results: PlaidSyncResult[] }>(response);
  return body.results;
}

export async function disconnectPlaidBank(connectionId: string): Promise<void> {
  const response = await fetch("/api/plaid/disconnect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ connectionId }),
  });
  await parseApiResponse(response);
}

export async function dismissPlaidRecurringSuggestion(
  merchantKey: string,
): Promise<void> {
  const response = await fetch("/api/plaid/dismiss-recurring", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ merchantKey }),
  });
  await parseApiResponse(response);
}

export function isPlaidReconnectRequired(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes("ITEM_LOGIN_REQUIRED") ||
      error.message.toLowerCase().includes("reconnect"))
  );
}
