import type Stripe from "stripe";

// Gross USD recurring run rate; not collected revenue or net proceeds.
export function subscriptionMrrContribution(subscription: Stripe.Subscription): number {
  return subscription.items.data.reduce((total, item) => {
    const { price } = item;
    if (price.currency !== "usd" || !price.recurring) return total;
    const amount = (Number(price.unit_amount_decimal ?? price.unit_amount ?? 0) / 100) * (item.quantity ?? 1);
    const count = price.recurring.interval_count;
    if (count <= 0) return total;
    const months = { day: 12 / 365.25, week: 12 / 52, month: 1, year: 12 }[price.recurring.interval];
    return total + amount / (count * months);
  }, 0);
}

type AppleRecord = {
  subscription_provider: string | null;
  subscription_status: string | null;
  subscription_current_period_end: string | null;
  apple_environment: string | null;
};

export function summarizeAppleRecords(rows: AppleRecord[], now = Date.now()) {
  let appleCurrentRecords = 0;
  let appleNeedsReconciliation = 0;
  for (const row of rows) {
    if (row.subscription_provider !== "apple" || row.apple_environment !== "Production") continue;
    if (row.subscription_status !== "active" && row.subscription_status !== "trialing") continue;
    const expiry = Date.parse(row.subscription_current_period_end ?? "");
    if (Number.isFinite(expiry) && expiry > now) appleCurrentRecords += 1;
    else appleNeedsReconciliation += 1;
  }
  return { appleCurrentRecords, appleNeedsReconciliation };
}
