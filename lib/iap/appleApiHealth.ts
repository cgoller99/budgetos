import "server-only";

import {
  AppStoreServerAPIClient,
  Environment,
} from "@apple/app-store-server-library";
import {
  getAppleIapConfig,
  getAppleIapConfigDiagnostics,
  type AppleIapConfigDiagnostic,
} from "@/lib/iap/config";
import { IAP_PRODUCT_IDS } from "@/lib/iap/products";

export type AppleApiAuthProbe = {
  environment: "Sandbox" | "Production";
  ok: boolean;
  httpStatusCode: number | null;
  /** High-level result only — never includes secrets or Apple error payloads with PII. */
  result:
    | "authenticated"
    | "unauthorized"
    | "not_configured"
    | "request_failed";
};

function classifyAppleAuthError(
  error: unknown,
): Omit<AppleApiAuthProbe, "environment"> {
  if (
    error &&
    typeof error === "object" &&
    "httpStatusCode" in error &&
    typeof (error as { httpStatusCode: unknown }).httpStatusCode === "number"
  ) {
    const httpStatusCode = (error as { httpStatusCode: number }).httpStatusCode;
    // Valid JWT + unknown transaction id → 404. That proves the .p8 key works.
    if (httpStatusCode === 404) {
      return { ok: true, httpStatusCode, result: "authenticated" };
    }
    if (httpStatusCode === 401 || httpStatusCode === 403) {
      return { ok: false, httpStatusCode, result: "unauthorized" };
    }
    // Other 4xx still means Apple accepted our JWT enough to return an API error.
    if (httpStatusCode >= 400 && httpStatusCode < 500) {
      return { ok: true, httpStatusCode, result: "authenticated" };
    }
    return { ok: false, httpStatusCode, result: "request_failed" };
  }

  return { ok: false, httpStatusCode: null, result: "request_failed" };
}

/**
 * Probes App Store Server API auth without exposing secrets.
 * Uses a non-existent transaction id; 404 means credentials work.
 */
export async function probeAppleApiAuth(
  environment: Environment,
): Promise<AppleApiAuthProbe> {
  const config = getAppleIapConfig();
  const label =
    environment === Environment.SANDBOX ? "Sandbox" : "Production";

  if (
    !config.isConfigured ||
    !config.privateKey ||
    !config.keyId ||
    !config.issuerId
  ) {
    return {
      environment: label,
      ok: false,
      httpStatusCode: null,
      result: "not_configured",
    };
  }

  try {
    const client = new AppStoreServerAPIClient(
      config.privateKey,
      config.keyId,
      config.issuerId,
      config.bundleId,
      environment,
    );
    await client.getTransactionInfo("0");
    return {
      environment: label,
      ok: true,
      httpStatusCode: 200,
      result: "authenticated",
    };
  } catch (error) {
    const classified = classifyAppleAuthError(error);
    return { environment: label, ...classified };
  }
}

export type ApplePrivateKeyFormatReport = {
  /** True when a non-empty private key env value was found after normalize. */
  present: boolean;
  /** Character length after normalize — never the key itself. */
  length: number;
  hasPkcs8Header: boolean;
  hasPkcs8Footer: boolean;
  hasRealNewlines: boolean;
  /** Issuer / key id shape checks (no values returned). */
  issuerIdLooksUuid: boolean;
  keyIdLooksPresent: boolean;
  keyIdLength: number;
  appAppleIdLooksNumeric: boolean;
};

/**
 * Inspect Apple credential *shape* only. Never returns secret material.
 */
export function inspectAppleCredentialFormats(): ApplePrivateKeyFormatReport {
  const config = getAppleIapConfig();
  const key = config.privateKey ?? "";
  const issuer = config.issuerId ?? "";
  const keyId = config.keyId ?? "";

  return {
    present: Boolean(key),
    length: key.length,
    hasPkcs8Header: key.includes("-----BEGIN PRIVATE KEY-----"),
    hasPkcs8Footer: key.includes("-----END PRIVATE KEY-----"),
    hasRealNewlines: key.includes("\n"),
    issuerIdLooksUuid:
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        issuer,
      ),
    keyIdLooksPresent: keyId.length > 0,
    keyIdLength: keyId.length,
    appAppleIdLooksNumeric:
      config.appAppleId != null && Number.isFinite(config.appAppleId),
  };
}

export type AppleIapHealthReport = {
  ok: boolean;
  service: "apple-iap-health";
  configured: boolean;
  bundleId: string;
  appAppleIdSet: boolean;
  preferredEnvironment: "Sandbox" | "Production";
  expectedProductIds: readonly string[];
  diagnostics: AppleIapConfigDiagnostic[];
  credentialFormats: ApplePrivateKeyFormatReport;
  apiAuth: {
    sandbox: AppleApiAuthProbe;
    production: AppleApiAuthProbe;
  };
};

export async function getAppleIapHealthReport(): Promise<AppleIapHealthReport> {
  const config = getAppleIapConfig();
  const diagnostics = getAppleIapConfigDiagnostics(config.preferredEnvironment);
  const preferredEnvironment =
    config.preferredEnvironment === Environment.SANDBOX
      ? "Sandbox"
      : "Production";
  const credentialFormats = inspectAppleCredentialFormats();

  const [sandbox, production] = await Promise.all([
    probeAppleApiAuth(Environment.SANDBOX),
    probeAppleApiAuth(Environment.PRODUCTION),
  ]);

  const apiAuthOk = sandbox.ok || production.ok;
  const formatOk =
    credentialFormats.present &&
    credentialFormats.hasPkcs8Header &&
    credentialFormats.hasPkcs8Footer &&
    credentialFormats.hasRealNewlines &&
    credentialFormats.issuerIdLooksUuid &&
    credentialFormats.keyIdLooksPresent &&
    credentialFormats.appAppleIdLooksNumeric;

  return {
    ok: config.isConfigured && apiAuthOk && formatOk,
    service: "apple-iap-health",
    configured: config.isConfigured,
    bundleId: config.bundleId,
    appAppleIdSet: config.appAppleId != null,
    preferredEnvironment,
    expectedProductIds: IAP_PRODUCT_IDS,
    diagnostics,
    credentialFormats,
    apiAuth: { sandbox, production },
  };
}
