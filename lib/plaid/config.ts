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

  if (normalized === "production" || normalized === "development") {
    return normalized;
  }

  return "sandbox";
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
): string | null {
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

  if (!isValidWebhookUrl(webhookUrl)) {
    return "PLAID_WEBHOOK_URL must be a valid https URL when set.";
  }

  return null;
}

export function getPlaidConfig(): PlaidConfig {
  const clientId = process.env.PLAID_CLIENT_ID?.trim();
  const secret = process.env.PLAID_SECRET?.trim();
  const environment = normalizePlaidEnvironment(process.env.PLAID_ENV);
  const tokenEncryptionKey = process.env.PLAID_TOKEN_ENCRYPTION_KEY?.trim();
  const webhookUrl = process.env.PLAID_WEBHOOK_URL?.trim();
  const configurationError = getConfigurationError(
    clientId,
    secret,
    tokenEncryptionKey,
    webhookUrl,
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
