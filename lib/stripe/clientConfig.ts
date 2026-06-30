export function isStripeClientEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_STRIPE_ENABLED === "true" &&
    Boolean(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim())
  );
}

export function getStripeProDisplayPrice(): string {
  return process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE?.trim() || "$7.99";
}

export function getStripeProPlusDisplayPrice(): string {
  return process.env.NEXT_PUBLIC_STRIPE_PRO_PLUS_PRICE?.trim() || "$14.99";
}

export function getStripeBillingPeriodLabel(): string {
  return "month";
}
