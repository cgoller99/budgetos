import "server-only";

import {
  AppStoreServerAPIClient,
  Environment,
  SignedDataVerifier,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";
import {
  assertAppleIapConfigured,
  getAppleIapConfig,
  type AppleIapConfig,
} from "@/lib/iap/config";
import { loadAppleRootCertificates } from "@/lib/iap/appleRootCertificates";

function createApiClient(
  config: AppleIapConfig,
  environment: Environment,
): AppStoreServerAPIClient {
  return new AppStoreServerAPIClient(
    config.privateKey!,
    config.keyId!,
    config.issuerId!,
    config.bundleId,
    environment,
  );
}

function createVerifier(
  config: AppleIapConfig,
  environment: Environment,
): SignedDataVerifier {
  const rootCAs = loadAppleRootCertificates();
  const appAppleId =
    environment === Environment.PRODUCTION
      ? config.appAppleId ?? undefined
      : undefined;

  if (environment === Environment.PRODUCTION && appAppleId == null) {
    throw new Error(
      "APPLE_IAP_APP_APPLE_ID is required to verify Production App Store signed data.",
    );
  }

  return new SignedDataVerifier(
    rootCAs,
    true,
    environment,
    config.bundleId,
    appAppleId,
  );
}

function environmentsToTry(preferred: Environment): Environment[] {
  if (preferred === Environment.SANDBOX) {
    return [Environment.SANDBOX, Environment.PRODUCTION];
  }

  return [Environment.PRODUCTION, Environment.SANDBOX];
}

export async function verifyAndDecodeSignedTransaction(
  signedTransactionInfo: string,
): Promise<{
  transaction: JWSTransactionDecodedPayload;
  environment: Environment;
}> {
  const config = assertAppleIapConfigured();
  let lastError: unknown;

  for (const environment of environmentsToTry(config.preferredEnvironment)) {
    try {
      const verifier = createVerifier(config, environment);
      const transaction = await verifier.verifyAndDecodeTransaction(
        signedTransactionInfo,
      );
      return { transaction, environment };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to verify Apple signed transaction.");
}

export async function fetchVerifiedTransactionById(transactionId: string): Promise<{
  transaction: JWSTransactionDecodedPayload;
  environment: Environment;
}> {
  const config = assertAppleIapConfigured();
  let lastError: unknown;

  for (const environment of environmentsToTry(config.preferredEnvironment)) {
    try {
      const client = createApiClient(config, environment);
      const response = await client.getTransactionInfo(transactionId);
      if (!response.signedTransactionInfo) {
        throw new Error("Apple transaction info response missing signed payload.");
      }

      const verifier = createVerifier(config, environment);
      const transaction = await verifier.verifyAndDecodeTransaction(
        response.signedTransactionInfo,
      );
      return { transaction, environment };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to load Apple transaction from App Store Server API.");
}

/**
 * Updates Apple's durable appAccountToken for a subscription lineage.
 * Used when StoreKit returns an existing sandbox/production lineage whose
 * signed token still belongs to a previous Buxme UUID after the current user
 * completed purchaseProduct with their own UUID.
 *
 * @see https://developer.apple.com/documentation/appstoreserverapi/set-app-account-token
 */
export async function setAppleAppAccountToken(input: {
  originalTransactionId: string;
  appAccountToken: string;
  preferredEnvironment?: Environment | string;
}): Promise<{ environment: Environment }> {
  const config = assertAppleIapConfigured();
  const preferred =
    input.preferredEnvironment != null
      ? (String(input.preferredEnvironment).toUpperCase() === "SANDBOX"
          ? Environment.SANDBOX
          : String(input.preferredEnvironment).toUpperCase() === "XCODE"
            ? Environment.SANDBOX
            : Environment.PRODUCTION)
      : config.preferredEnvironment;

  let lastError: unknown;

  for (const environment of environmentsToTry(preferred)) {
    try {
      const client = createApiClient(config, environment);
      await client.setAppAccountToken(input.originalTransactionId, {
        appAccountToken: input.appAccountToken,
      });
      return { environment };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to set Apple appAccountToken via App Store Server API.");
}

export async function verifyAndDecodeNotificationPayload(
  signedPayload: string,
): Promise<{
  notification: ResponseBodyV2DecodedPayload;
  environment: Environment;
}> {
  const config = assertAppleIapConfigured();
  let lastError: unknown;

  for (const environment of environmentsToTry(config.preferredEnvironment)) {
    try {
      if (
        environment === Environment.PRODUCTION &&
        getAppleIapConfig().appAppleId == null
      ) {
        continue;
      }

      const verifier = createVerifier(config, environment);
      const notification = await verifier.verifyAndDecodeNotification(signedPayload);
      return { notification, environment };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Unable to verify App Store Server Notification payload.");
}

export async function verifyAndDecodeSignedRenewalInfo(
  signedRenewalInfo: string,
  environment: Environment,
) {
  const config = assertAppleIapConfigured();
  const verifier = createVerifier(config, environment);
  return verifier.verifyAndDecodeRenewalInfo(signedRenewalInfo);
}
