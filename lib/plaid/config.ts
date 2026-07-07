import { PLAID_PRODUCTION_WEBHOOK_URL } from "@/lib/plaid/constants";

export type PlaidEnvironment = "sandbox" | "development" | "production";

export type PlaidConfig = {
  isConfigured: boolean;
  clientId: string | undefined;
  secret: string | undefined;
  environment: PlaidEnvironment;
  tokenEncryptionKey: string | undefined;
  webhookUrl: string | undefined;
  configurationError: string | null;
};

const PLACEHOLDER_CLIENT_IDS = new Set([
  "your-plaid-client-id",
  "plaid_client_id",
  "xxxxxxxx",
]);

const PLACEHOLDER_SECRETS = new Set([
  "your-plaid-secret",
  "plaid_secret",
  "xxxxxxxx",
]);

const PLACEHOLDER_ENCRYPTION_KEYS = new Set([
  "your-32-byte-encryption-key",
  "change-me",
  "xxxxxxxx",
]);

function normalizePlaidEnvironment(value: string | undefined): PlaidEnvironment {
  const normalized = value?.trim().toLowerCase();

  if (
    normalized === "production" ||
    normalized === "development" ||
    normalized === "sandbox"
  ) {
    return normalized;
  }

  return "production";
}

function normalizePlaidWebhookUrl(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  let normalized = value.trim();

  // Common copy-paste from docs/templates: "URL=https://..."
  const urlPrefixMatch = normalized.match(/^URL=(.+)$/i);
  if (urlPrefixMatch) {
    normalized = urlPrefixMatch[1].trim();
  }

  return normalized;
}

function resolveEffectiveWebhookUrl(
  webhookUrl: string | undefined,
  environment: PlaidEnvironment,
): string | undefined {
  if (webhookUrl) {
    return webhookUrl;
  }

  if (environment === "production") {
    return PLAID_PRODUCTION_WEBHOOK_URL;
  }

  return undefined;
}

export function resolvePlaidWebhookUrl(config: PlaidConfig): string {
  return config.webhookUrl ?? PLAID_PRODUCTION_WEBHOOK_URL;
}

export function isPlaidWebhookVerificationRequired(): boolean {
  return getPlaidConfig().environment === "production";
}

export function getPlaidEnvironmentLabel(environment: PlaidEnvironment): string {
  switch (environment) {
    case "production":
      return "Production";
    case "development":
      return "Development";
    default:
      return "Sandbox";
  }
}

function isValidWebhookUrl(value: string | undefined): boolean {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

function getConfigurationError(
  clientId: string | undefined,
  secret: string | undefined,
  tokenEncryptionKey: string | undefined,
  webhookUrl: string | undefined,
  environment: PlaidEnvironment,
): string | null {
  const effectiveWebhookUrl = resolveEffectiveWebhookUrl(webhookUrl, environment);

  if (process.env.VERCEL_ENV === "production" && environment === "sandbox") {
    return "PLAID_ENV cannot be sandbox in production. Set PLAID_ENV=production and use production API keys from the Plaid Dashboard.";
  }

  if (environment === "production") {
    if (effectiveWebhookUrl !== PLAID_PRODUCTION_WEBHOOK_URL) {
      return `PLAID_WEBHOOK_URL must be ${PLAID_PRODUCTION_WEBHOOK_URL} in production.`;
    }
  }
  if (!clientId) {
    return "PLAID_CLIENT_ID is missing. Add it to .env.local and restart the dev server.";
  }

  if (PLACEHOLDER_CLIENT_IDS.has(clientId) || clientId.includes("xxxx")) {
    return "PLAID_CLIENT_ID is still a placeholder. Paste your real key from the Plaid Dashboard.";
  }

  if (!secret) {
    return "PLAID_SECRET is missing. Add it to .env.local and restart the dev server.";
  }

  if (PLACEHOLDER_SECRETS.has(secret) || secret.includes("xxxx")) {
    return "PLAID_SECRET is still a placeholder. Paste your real secret from the Plaid Dashboard.";
  }

  if (!tokenEncryptionKey) {
    return "PLAID_TOKEN_ENCRYPTION_KEY is missing. Generate a 32+ character secret for encrypting access tokens.";
  }

  if (
    PLACEHOLDER_ENCRYPTION_KEYS.has(tokenEncryptionKey) ||
    tokenEncryptionKey.includes("xxxx")
  ) {
    return "PLAID_TOKEN_ENCRYPTION_KEY is still a placeholder. Generate a secure random string (32+ chars).";
  }

  if (tokenEncryptionKey.length < 32) {
    return "PLAID_TOKEN_ENCRYPTION_KEY must be at least 32 characters for AES-256-GCM.";
  }

  if (!isValidWebhookUrl(effectiveWebhookUrl)) {
    return "PLAID_WEBHOOK_URL must be a valid https URL when set.";
  }

  return null;
}

export function getPlaidConfig(): PlaidConfig {
  const clientId = process.env.PLAID_CLIENT_ID?.trim();
  const secret = process.env.PLAID_SECRET?.trim();
  const environment = normalizePlaidEnvironment(process.env.PLAID_ENV);
  const tokenEncryptionKey = process.env.PLAID_TOKEN_ENCRYPTION_KEY?.trim();
  const rawWebhookUrl = normalizePlaidWebhookUrl(process.env.PLAID_WEBHOOK_URL);
  const webhookUrl = resolveEffectiveWebhookUrl(rawWebhookUrl, environment);
  const configurationError = getConfigurationError(
    clientId,
    secret,
    tokenEncryptionKey,
    rawWebhookUrl,
    environment,
  );

  return {
    isConfigured: configurationError === null,
    clientId,
    secret,
    environment,
    tokenEncryptionKey,
    webhookUrl,
    configurationError,
  };
}

export function assertPlaidConfigured(): void {
  const { configurationError } = getPlaidConfig();

  if (configurationError) {
    throw new Error(configurationError);
  }
}

export function isPlaidEnabled(): boolean {
  return getPlaidConfig().isConfigured;
}

export type PlaidEnvVarStatus = "present" | "empty" | "missing";

export type PlaidConfigDiagnostic = {
  variable: string;
  status: PlaidEnvVarStatus;
  requiredForConfigured: boolean;
};

const PLAID_CONFIGURED_VARS = [
  "PLAID_CLIENT_ID",
  "PLAID_SECRET",
  "PLAID_ENV",
  "PLAID_TOKEN_ENCRYPTION_KEY",
  "PLAID_WEBHOOK_URL",
] as const;

export function getPlaidConfigDiagnostics(): PlaidConfigDiagnostic[] {
  return PLAID_CONFIGURED_VARS.map((variable) => {
    const raw = process.env[variable];
    let status: PlaidEnvVarStatus = "missing";

    if (raw !== undefined) {
      status = raw.trim() === "" ? "empty" : "present";
    }

    return {
      variable,
      status,
      requiredForConfigured: true,
    };
  });
}
