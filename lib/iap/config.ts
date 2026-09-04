import "server-only";

import { Environment } from "@apple/app-store-server-library";

export const APPLE_IAP_BUNDLE_ID = "co.buxme.app";

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

function normalizePrivateKey(raw: string | undefined): string | null {
  const value = raw?.trim();
  if (!value) {
    return null;
  }

  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

function parseAppAppleId(raw: string | undefined): number | null {
  const value = raw?.trim();
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parsePreferredEnvironment(raw: string | undefined): Environment {
  const value = raw?.trim().toLowerCase();
  if (value === "sandbox") {
    return Environment.SANDBOX;
  }

  return Environment.PRODUCTION;
}

/**
 * Production appears configured only when APPLE_IAP_APP_APPLE_ID is present.
 * Sandbox/TestFlight may omit the numeric App Apple ID (Apple verifier allows that).
 */
export function getAppleIapConfig(): AppleIapConfig {
  const issuerId = process.env.APPLE_IAP_ISSUER_ID?.trim() || null;
  const keyId = process.env.APPLE_IAP_KEY_ID?.trim() || null;
  const privateKey = normalizePrivateKey(process.env.APPLE_IAP_PRIVATE_KEY);
  const appAppleId = parseAppAppleId(process.env.APPLE_IAP_APP_APPLE_ID);
  const bundleId =
    process.env.APPLE_IAP_BUNDLE_ID?.trim() || APPLE_IAP_BUNDLE_ID;
  const preferredEnvironment = parsePreferredEnvironment(
    process.env.APPLE_IAP_ENVIRONMENT,
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
  if (!config.hasApiCredentials || !config.issuerId || !config.keyId || !config.privateKey) {
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
