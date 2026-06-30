"use client";

import type { UserSubscription } from "@/lib/subscription/types";

type ApiErrorBody = {
  error?: string;
  code?: string;
};

export type EntitlementsResponse = {
  isFounder: boolean;
  subscription: UserSubscription;
  hasProAccess: boolean;
  hasProPlusAccess: boolean;
};

async function parseApiResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & ApiErrorBody;

  if (!response.ok) {
    throw new Error(body.error ?? "Request failed.");
  }

  return body;
}

export async function fetchEntitlements(options?: {
  refresh?: boolean;
}): Promise<EntitlementsResponse> {
  const query = options?.refresh ? "?refresh=true" : "";
  const response = await fetch(`/api/entitlements${query}`, {
    method: "GET",
    cache: "no-store",
  });
  return parseApiResponse<EntitlementsResponse>(response);
}
