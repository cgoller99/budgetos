import "server-only";

import { Environment } from "@apple/app-store-server-library";

export const APPLE_IAP_BUNDLE_ID = "co.buxme.app";

export type AppleIapConfig = {
  isConfigured: boolean;
  issuerId: string | null;
  keyId: string | null;
  privateKey: string | null;
  bundleId: string;
  /** Numeric App Store Connect app Apple ID (required for Production JWS verification). */
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

export function getAppleIapConfig(): AppleIapConfig {
  const issuerId = process.env.APPLE_IAP_ISSUER_ID?.trim() || null;
  const keyId = process.env.APPLE_IAP_KEY_ID?.trim() || null;
  const privateKey = normalizePrivateKey(process.env.APPLE_IAP_PRIVATE_KEY);
  const appAppleId = parseAppAppleId(process.env.APPLE_IAP_APP_APPLE_ID);
  const bundleId =
    process.env.APPLE_IAP_BUNDLE_ID?.trim() || APPLE_IAP_BUNDLE_ID;

  return {
    isConfigured: Boolean(issuerId && keyId && privateKey),
    issuerId,
    keyId,
    privateKey,
    bundleId,
    appAppleId,
    preferredEnvironment: parsePreferredEnvironment(
      process.env.APPLE_IAP_ENVIRONMENT,
    ),
  };
}

export function assertAppleIapConfigured(): AppleIapConfig {
  const config = getAppleIapConfig();
  if (!config.isConfigured || !config.issuerId || !config.keyId || !config.privateKey) {
    throw new Error(
      "Apple IAP verification is not configured. Set APPLE_IAP_ISSUER_ID, APPLE_IAP_KEY_ID, and APPLE_IAP_PRIVATE_KEY.",
    );
  }

  return config;
}
