export type EmailConfig = {
  isConfigured: boolean;
  apiKey: string | undefined;
  fromEmail: string;
  fromName: string;
  configurationError: string | null;
};

const PLACEHOLDER_KEYS = new Set(["re_xxxxx", "re_your_resend_api_key", "your-api-key"]);

function getConfigurationError(apiKey: string | undefined): string | null {
  if (!apiKey) {
    return "RESEND_API_KEY is missing. Add it to .env.local and restart the dev server.";
  }

  if (PLACEHOLDER_KEYS.has(apiKey) || apiKey.includes("xxxx")) {
    return "RESEND_API_KEY is still a placeholder. Paste your real key from https://resend.com/api-keys";
  }

  if (!apiKey.startsWith("re_") || apiKey.length < 20) {
    return "RESEND_API_KEY looks invalid. Resend keys start with re_ and are longer than 20 characters.";
  }

  return null;
}

export function getEmailConfig(): EmailConfig {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail =
    process.env.RESEND_FROM_EMAIL?.trim() || "noreply@buxme.co";
  const fromName = process.env.RESEND_FROM_NAME?.trim() || "Buxme";
  const configurationError = getConfigurationError(apiKey);

  return {
    isConfigured: configurationError === null,
    apiKey,
    fromEmail,
    fromName,
    configurationError,
  };
}

export function assertEmailConfigured(): void {
  const { configurationError } = getEmailConfig();

  if (configurationError) {
    throw new Error(configurationError);
  }
}
