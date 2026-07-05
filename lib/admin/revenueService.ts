import "server-only";

import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/stripeClient";
import { isStripeEnabled } from "@/lib/stripe/config";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";

import type { AdminRevenueMetrics } from "@/lib/admin/types";

export type { AdminRevenueMetrics } from "@/lib/admin/types";

function subscriptionMrrContribution(subscription: Stripe.Subscription): number {
  let total = 0;

  for (const item of subscription.items.data) {
    const amount = (item.price.unit_amount ?? 0) / 100;
    const interval = item.price.recurring?.interval;

    if (interval === "year") {
      total += amount / 12;
    } else {
      total += amount;
    }
  }

  return total;
}

export async function getAdminRevenueMetrics(
  adminSupabase: BuxmeSupabaseClient,
): Promise<AdminRevenueMetrics> {
  const { data: profiles, error } = await adminSupabase
    .from("profiles")
    .select("subscription_plan, subscription_status");

  if (error) {
    throw error;
  }

  const rows = profiles ?? [];
  const freeUsers = rows.filter((row) => row.subscription_plan === "free").length;
  const proUsers = rows.filter(
    (row) =>
      row.subscription_plan === "pro" &&
      ["active", "trialing", "past_due"].includes(row.subscription_status),
  ).length;
  const proPlusUsers = rows.filter(
    (row) =>
      row.subscription_plan === "pro_plus" &&
      ["active", "trialing", "past_due"].includes(row.subscription_status),
  ).length;

  if (!isStripeEnabled()) {
    return {
      available: false,
      mrr: 0,
      arr: 0,
      freeUsers,
      proUsers,
      proPlusUsers,
      churnRate: 0,
      newSubscriptions: 0,
      cancellations: 0,
      failedPayments: 0,
    };
  }

  const stripe = getStripeClient();
  let mrr = 0;
  let hasMore = true;
  let startingAfter: string | undefined;
  const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

  let newSubscriptions = 0;
  let cancellations = 0;

  while (hasMore) {
    const page = await stripe.subscriptions.list({
      status: "all",
      limit: 100,
      starting_after: startingAfter,
      expand: ["data.items.data.price"],
    });

    for (const subscription of page.data) {
      if (subscription.status === "active" || subscription.status === "trialing") {
        mrr += subscriptionMrrContribution(subscription);
      }

      if (subscription.created >= thirtyDaysAgo && subscription.status !== "canceled") {
        newSubscriptions += 1;
      }

      if (
        subscription.status === "canceled" &&
        (subscription.canceled_at ?? 0) >= thirtyDaysAgo
      ) {
        cancellations += 1;
      }
    }

    hasMore = page.has_more;
    startingAfter = page.data.at(-1)?.id;
  }

  const failedInvoices = await stripe.invoices.list({
    status: "open",
    limit: 100,
  });

  const activeBase = Math.max(proUsers + proPlusUsers + cancellations, 1);
  const churnRate = Number(((cancellations / activeBase) * 100).toFixed(1));

  return {
    available: true,
    mrr: Number(mrr.toFixed(2)),
    arr: Number((mrr * 12).toFixed(2)),
    freeUsers,
    proUsers,
    proPlusUsers,
    churnRate,
    newSubscriptions,
    cancellations,
    failedPayments: failedInvoices.data.length,
  };
}

export async function getAdminDailyRevenueSeries(): Promise<Array<{ date: string; value: number }>> {
  if (!isStripeEnabled()) {
    return [];
  }

  const stripe = getStripeClient();
  const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
  const charges = await stripe.charges.list({
    created: { gte: since },
    limit: 100,
  });

  const counts = new Map<string, number>();

  for (let index = 29; index >= 0; index -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - index);
    counts.set(date.toISOString().slice(0, 10), 0);
  }

  for (const charge of charges.data) {
    if (!charge.paid || charge.status !== "succeeded") {
      continue;
    }

    const key = new Date(charge.created * 1000).toISOString().slice(0, 10);
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + (charge.amount ?? 0) / 100);
    }
  }

  return [...counts.entries()].map(([date, value]) => ({
    date,
    value: Number(value.toFixed(2)),
  }));
}
