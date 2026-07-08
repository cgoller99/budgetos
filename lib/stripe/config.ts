export type StripeConfig = {
  isConfigured: boolean;
  secretKey: string | undefined;
  webhookSecret: string | undefined;
  proPriceId: string | undefined;
  proPlusPriceId: string | undefined;
  proProductId: string | undefined;
  proPlusProductId: string | undefined;
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

function isValidProductId(value: string | undefined): boolean {
  return Boolean(value && value.startsWith("prod_"));
}

function hasPlanReference(
  priceId: string | undefined,
  productId: string | undefined,
): boolean {
  return isValidPriceId(priceId) || isValidProductId(productId);
}

function getConfigurationError(
  secretKey: string | undefined,
  proPriceId: string | undefined,
  proPlusPriceId: string | undefined,
  proProductId: string | undefined,
  proPlusProductId: string | undefined,
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

  if (!hasPlanReference(proPriceId, proProductId)) {
    return "STRIPE_PRO_PRICE_ID or STRIPE_PRO_PRODUCT_ID is missing or invalid.";
  }

  if (!hasPlanReference(proPlusPriceId, proPlusProductId)) {
    return "STRIPE_PRO_PLUS_PRICE_ID or STRIPE_PRO_PLUS_PRODUCT_ID is missing or invalid.";
  }

  return null;
}

export function getStripeConfig(): StripeConfig {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const proPriceId = process.env.STRIPE_PRO_PRICE_ID?.trim();
  const proPlusPriceId = process.env.STRIPE_PRO_PLUS_PRICE_ID?.trim();
  const proProductId = process.env.STRIPE_PRO_PRODUCT_ID?.trim();
  const proPlusProductId = process.env.STRIPE_PRO_PLUS_PRODUCT_ID?.trim();
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
    proProductId,
    proPlusProductId,
  );

  return {
    isConfigured: configurationError === null,
    secretKey,
    webhookSecret,
    proPriceId,
    proPlusPriceId,
    proProductId,
    proPlusProductId,
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

export type StripeEnvVarStatus = "present" | "empty" | "missing";

export type StripeConfigDiagnostic = {
  variable: string;
  status: StripeEnvVarStatus;
  requiredForConfigured: boolean;
};

const STRIPE_CONFIGURED_VARS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRO_PRICE_ID",
  "STRIPE_PRO_PLUS_PRICE_ID",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_STRIPE_ENABLED",
] as const;

export function getStripeConfigDiagnostics(): StripeConfigDiagnostic[] {
  return STRIPE_CONFIGURED_VARS.map((variable) => {
    const raw = process.env[variable];
    let status: StripeEnvVarStatus = "missing";

    if (raw !== undefined) {
      status = raw.trim() === "" ? "empty" : "present";
    }

    return {
      variable,
      status,
      requiredForConfigured: variable !== "STRIPE_WEBHOOK_SECRET",
    };
  });
}
