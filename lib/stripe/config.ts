export type StripeConfig = {
  isConfigured: boolean;
  secretKey: string | undefined;
  webhookSecret: string | undefined;
  proPriceId: string | undefined;
  proPlusPriceId: string | undefined;
  publishableKey: string | undefined;
  proDisplayPrice: string;
  proPlusDisplayPrice: string;
  siteUrl: string;
  configurationError: string | null;
};

const PLACEHOLDER_SECRETS = new Set([
  "sk_test_xxxx",
  "sk_live_xxxx",
  "your-stripe-secret-key",
]);

const PLACEHOLDER_PRICE_IDS = new Set([
  "price_xxxx",
  "your-price-id",
]);

function isValidPriceId(value: string | undefined): boolean {
  return Boolean(value && value.startsWith("price_") && !PLACEHOLDER_PRICE_IDS.has(value));
}

function getConfigurationError(
  secretKey: string | undefined,
  proPriceId: string | undefined,
  proPlusPriceId: string | undefined,
): string | null {
  if (!secretKey) {
    return "STRIPE_SECRET_KEY is missing. Add it to .env.local and restart the dev server.";
  }

  if (
    PLACEHOLDER_SECRETS.has(secretKey) ||
    secretKey.includes("xxxx") ||
    (!secretKey.startsWith("sk_test_") && !secretKey.startsWith("sk_live_"))
  ) {
    return "STRIPE_SECRET_KEY looks invalid. Use a test or live secret key from the Stripe Dashboard.";
  }

  if (!isValidPriceId(proPriceId)) {
    return "STRIPE_PRO_PRICE_ID is missing or invalid. Create a $7.99/month price in Stripe and add its ID.";
  }

  if (!isValidPriceId(proPlusPriceId)) {
    return "STRIPE_PRO_PLUS_PRICE_ID is missing or invalid. Create a $14.99/month price in Stripe and add its ID.";
  }

  return null;
}

export function getStripeConfig(): StripeConfig {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID?.trim();
  const proPlusPriceId = process.env.STRIPE_PRO_PLUS_PRICE_ID?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  const proDisplayPrice =
    process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE?.trim() || "$7.99";
  const proPlusDisplayPrice =
    process.env.NEXT_PUBLIC_STRIPE_PRO_PLUS_PRICE?.trim() || "$14.99";
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    "http://localhost:3000";
  const configurationError = getConfigurationError(
    secretKey,
    proPriceId,
    proPlusPriceId,
  );

  return {
    isConfigured: configurationError === null,
    secretKey,
    webhookSecret,
    proPriceId,
    proPlusPriceId,
    publishableKey,
    proDisplayPrice,
    proPlusDisplayPrice,
    siteUrl,
    configurationError,
  };
}

export function assertStripeConfigured(): void {
  const { configurationError } = getStripeConfig();

  if (configurationError) {
    throw new Error(configurationError);
  }
}

export function isStripeEnabled(): boolean {
  return getStripeConfig().isConfigured;
}

export function isStripeTestMode(): boolean {
  return getStripeConfig().secretKey?.startsWith("sk_test_") ?? true;
}

export function getPriceIdForPlan(plan: "pro" | "pro_plus"): string {
  const config = getStripeConfig();

  if (plan === "pro_plus") {
    if (!config.proPlusPriceId) {
      throw new Error("STRIPE_PRO_PLUS_PRICE_ID is missing.");
    }

    return config.proPlusPriceId;
  }

  if (!config.proPriceId) {
    throw new Error("STRIPE_PRO_PRICE_ID is missing.");
  }

  return config.proPriceId;
}

export function resolvePlanFromPriceId(priceId: string | null | undefined): "free" | "pro" | "pro_plus" {
  const config = getStripeConfig();

  if (priceId && priceId === config.proPlusPriceId) {
    return "pro_plus";
  }

  if (priceId && priceId === config.proPriceId) {
    return "pro";
  }

  return "free";
}
