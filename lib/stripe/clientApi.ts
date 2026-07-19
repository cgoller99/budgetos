"use client";

import type { BillingInterval } from "@/lib/stripe/billingInterval";
import type { PaidSubscriptionPlan, UserSubscription } from "@/lib/subscription/types";

type ApiErrorBody = {
  error?: string;
  code?: string;
};

async function parseApiResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & ApiErrorBody;

  if (!response.ok) {
    throw new Error(body.error ?? "Stripe request failed.");
  }

  return body;
}

export async function fetchUserSubscription(options?: {
  refresh?: boolean;
}): Promise<UserSubscription> {
  const query = options?.refresh ? "?refresh=true" : "";
  const response = await fetch(`/api/stripe/subscription${query}`, {
    method: "GET",
    cache: "no-store",
  });
  const body = await parseApiResponse<{ subscription: UserSubscription }>(
    response,
  );
  return body.subscription;
}

export async function startStripeCheckout(
  plan: PaidSubscriptionPlan,
  billing: BillingInterval = "month",
): Promise<string> {
  const response = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, billing }),
  });
  const body = await parseApiResponse<{ url: string }>(response);
  return body.url;
}

export async function changeStripePlan(
  plan: PaidSubscriptionPlan,
): Promise<UserSubscription> {
  const response = await fetch("/api/stripe/change-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  const body = await parseApiResponse<{ subscription: UserSubscription }>(
    response,
  );
  return body.subscription;
}

export async function cancelStripeSubscription(options?: {
  atPeriodEnd?: boolean;
}): Promise<UserSubscription> {
  const response = await fetch("/api/stripe/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ atPeriodEnd: options?.atPeriodEnd ?? true }),
  });
  const body = await parseApiResponse<{ subscription: UserSubscription }>(
    response,
  );
  return body.subscription;
}

export async function reactivateStripeSubscription(): Promise<UserSubscription> {
  const response = await fetch("/api/stripe/reactivate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const body = await parseApiResponse<{ subscription: UserSubscription }>(
    response,
  );
  return body.subscription;
}

export async function openStripeBillingPortal(): Promise<string> {
  const response = await fetch("/api/stripe/portal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const body = await parseApiResponse<{ url: string }>(response);
  return body.url;
}
