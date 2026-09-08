import "server-only";

import { Environment } from "@apple/app-store-server-library";

export const APPLE_IAP_BUNDLE_ID = "co.buxme.app";

/** Env var names read by getAppleIapConfig / isConfigured. */
export const APPLE_IAP_ENV = {
  issuerId: "APPLE_IAP_ISSUER_ID",
  keyId: "APPLE_IAP_KEY_ID",
  privateKey: "APPLE_IAP_PRIVATE_KEY",
  appAppleId: "APPLE_IAP_APP_APPLE_ID",
  bundleId: "APPLE_IAP_BUNDLE_ID",
  environment: "APPLE_IAP_ENVIRONMENT",
} as const;

export type AppleIapConfig = {
  /** True when this process can safely verify for the preferred environment. */
  isConfigured: boolean;
  /** issuer + key + private key present (Sandbox may omit App Apple ID). */
  hasApiCredentials: boolean;
  issuerId: string | null;
  keyId: string | null;
  privateKey: string | null;
  bundleId: string;
  /** Numeric App Store Connect app Apple ID (required for Production JWS / ASN). */
  appAppleId: number | null;
  /** Preferred environment for API calls; verification also falls back across Sandbox/Production. */
  preferredEnvironment: Environment;
};

export type AppleIapEnvPresence = "missing" | "empty" | "present";

export type AppleIapConfigDiagnostic = {
  variable: string;
  presence: AppleIapEnvPresence;
  requiredForConfigured: boolean;
};

/**
 * Strip one layer of wrapping single/double quotes (common when pasting into Vercel).
 * Does not log or return secret material beyond the cleaned string.
 */
export function stripWrappingQuotes(raw: string): string {
  const value = raw.trim();
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1).trim();
    }
  }
  return value;
}

/**
 * Normalize an In-App Purchase .p8 private key from Vercel / .env storage.
 * Supports:
 * - real newlines
 * - literal `\n` and `\r\n` escape sequences
 * - optional wrapping quotes
 * Never logs the key material.
 */
export function normalizePrivateKey(raw: string | undefined): string | null {
  if (raw == null) {
    return null;
  }

  let value = stripWrappingQuotes(raw);
  if (!value) {
    return null;
  }

  // Expand common single-line PEM encodings used in Vercel env values.
  if (value.includes("\\r\\n")) {
    value = value.replace(/\\r\\n/g, "\n");
  }
  if (value.includes("\\n")) {
    value = value.replace(/\\n/g, "\n");
  }
  // Normalize Windows newlines if the dashboard preserved them.
  if (value.includes("\r\n")) {
    value = value.replace(/\r\n/g, "\n");
  } else if (value.includes("\r")) {
    value = value.replace(/\r/g, "\n");
  }

  return value.trim() ? value : null;
}

export function parseAppAppleId(raw: string | undefined): number | null {
  if (raw == null) {
    return null;
  }

  const value = stripWrappingQuotes(raw);
  if (!value) {
    return null;
  }

  // Accept plain digits or values with incidental surrounding text/BOM.
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) {
    return null;
  }

  const parsed = Number(digits);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parsePreferredEnvironment(raw: string | undefined): Environment {
  const value = stripWrappingQuotes(raw ?? "").toLowerCase();
  if (value === "sandbox") {
    return Environment.SANDBOX;
  }

  return Environment.PRODUCTION;
}

function envPresence(raw: string | undefined): AppleIapEnvPresence {
  if (raw === undefined) {
    return "missing";
  }
  return stripWrappingQuotes(raw) === "" ? "empty" : "present";
}

/**
 * Secret-safe presence diagnostics for Apple IAP env vars (no values).
 */
export function getAppleIapConfigDiagnostics(
  preferredEnvironment: Environment = parsePreferredEnvironment(
    process.env[APPLE_IAP_ENV.environment],
  ),
): AppleIapConfigDiagnostic[] {
  const productionRequiresAppAppleId =
    preferredEnvironment === Environment.PRODUCTION;

  return [
    {
      variable: APPLE_IAP_ENV.issuerId,
      presence: envPresence(process.env[APPLE_IAP_ENV.issuerId]),
      requiredForConfigured: true,
    },
    {
      variable: APPLE_IAP_ENV.keyId,
      presence: envPresence(process.env[APPLE_IAP_ENV.keyId]),
      requiredForConfigured: true,
    },
    {
      variable: APPLE_IAP_ENV.privateKey,
      presence: envPresence(process.env[APPLE_IAP_ENV.privateKey]),
      requiredForConfigured: true,
    },
    {
      variable: APPLE_IAP_ENV.appAppleId,
      presence: envPresence(process.env[APPLE_IAP_ENV.appAppleId]),
      requiredForConfigured: productionRequiresAppAppleId,
    },
  ];
}

/**
 * Production appears configured only when APPLE_IAP_APP_APPLE_ID is present.
 * Sandbox/TestFlight may omit the numeric App Apple ID (Apple verifier allows that).
 */
export function getAppleIapConfig(): AppleIapConfig {
  const issuerId =
    stripWrappingQuotes(process.env[APPLE_IAP_ENV.issuerId] ?? "") || null;
  const keyId =
    stripWrappingQuotes(process.env[APPLE_IAP_ENV.keyId] ?? "") || null;
  const privateKey = normalizePrivateKey(process.env[APPLE_IAP_ENV.privateKey]);
  const appAppleId = parseAppAppleId(process.env[APPLE_IAP_ENV.appAppleId]);
  const bundleId =
    stripWrappingQuotes(process.env[APPLE_IAP_ENV.bundleId] ?? "") ||
    APPLE_IAP_BUNDLE_ID;
  const preferredEnvironment = parsePreferredEnvironment(
    process.env[APPLE_IAP_ENV.environment],
  );
  const hasApiCredentials = Boolean(issuerId && keyId && privateKey);
  const productionRequiresAppAppleId =
    preferredEnvironment === Environment.PRODUCTION;

  return {
    hasApiCredentials,
    isConfigured:
      hasApiCredentials &&
      (!productionRequiresAppAppleId || appAppleId != null),
    issuerId,
    keyId,
    privateKey,
    bundleId,
    appAppleId,
    preferredEnvironment,
  };
}

export function assertAppleIapConfigured(): AppleIapConfig {
  const config = getAppleIapConfig();
  if (
    !config.hasApiCredentials ||
    !config.issuerId ||
    !config.keyId ||
    !config.privateKey
  ) {
    throw new Error(
      "Apple IAP verification is not configured. Set APPLE_IAP_ISSUER_ID, APPLE_IAP_KEY_ID, and APPLE_IAP_PRIVATE_KEY.",
    );
  }

  if (
    config.preferredEnvironment === Environment.PRODUCTION &&
    config.appAppleId == null
  ) {
    throw new Error(
      "Apple IAP Production verification requires APPLE_IAP_APP_APPLE_ID.",
    );
  }

  if (!config.isConfigured) {
    throw new Error("Apple IAP verification is not fully configured.");
  }

  return config;
}
