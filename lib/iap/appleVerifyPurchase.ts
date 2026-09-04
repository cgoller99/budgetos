import "server-only";

import type { Environment, JWSTransactionDecodedPayload } from "@apple/app-store-server-library";
import {
  getAppleIapConfig,
  assertAppleIapConfigured,
} from "@/lib/iap/config";
import {
  isVerifiedAppleTransactionCurrentlyValid,
  planFromVerifiedAppleProduct,
} from "@/lib/iap/appleEntitlementPolicy";
import {
  fetchVerifiedTransactionById,
  verifyAndDecodeSignedTransaction,
} from "@/lib/iap/appleServerClient";
import {
  clearAppleSubscriptionOnProfile,
  syncVerifiedAppleSubscriptionToProfile,
} from "@/lib/iap/appleSubscriptionService";
import type { IapPlan } from "@/lib/iap/products";

export class ApplePurchaseVerificationError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status = 400) {
    super(message);
    this.name = "ApplePurchaseVerificationError";
    this.code = code;
    this.status = status;
  }
}

export type ClientApplePurchasePayload = {
  productId?: string | null;
  transactionId?: string | null;
  originalTransactionId?: string | null;
  signedTransactionInfo?: string | null;
  receipt?: string | null;
  environment?: string | null;
};

export type VerifiedApplePurchase = {
  plan: IapPlan;
  productId: string;
  transactionId: string;
  originalTransactionId: string;
  expiresAt: string;
  environment: string;
  bundleId: string;
  revocationDate: string | null;
};

function toIsoFromMs(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  return new Date(value).toISOString();
}

export function mapDecodedTransactionToVerifiedPurchase(
  transaction: JWSTransactionDecodedPayload,
  environment: Environment | string,
): VerifiedApplePurchase {
  const config = getAppleIapConfig();
  const validity = isVerifiedAppleTransactionCurrentlyValid({
    productId: transaction.productId,
    bundleId: transaction.bundleId,
    expectedBundleId: config.bundleId,
    expiresDateMs: transaction.expiresDate,
    revocationDateMs: transaction.revocationDate,
  });

  if (!validity.valid || !validity.plan) {
    throw new ApplePurchaseVerificationError(
      `Apple purchase is not eligible for Premium (${validity.reason ?? "invalid"}).`,
      validity.reason ?? "invalid_transaction",
      400,
    );
  }

  if (!transaction.transactionId || !transaction.originalTransactionId) {
    throw new ApplePurchaseVerificationError(
      "Verified Apple transaction is missing identifiers.",
      "missing_transaction_ids",
    );
  }

  const expiresAt = toIsoFromMs(transaction.expiresDate);
  if (!expiresAt) {
    throw new ApplePurchaseVerificationError(
      "Verified Apple transaction is missing expiration.",
      "missing_expiry",
    );
  }

  return {
    plan: validity.plan,
    productId: transaction.productId!,
    transactionId: transaction.transactionId,
    originalTransactionId: transaction.originalTransactionId,
    expiresAt,
    environment: String(environment),
    bundleId: transaction.bundleId!,
    revocationDate: toIsoFromMs(transaction.revocationDate),
  };
}

/**
 * Cryptographically verifies an Apple purchase via signed JWS and/or App Store Server API.
 * Never trusts client product/expiry fields for entitlement grants.
 */
export async function verifyClientApplePurchase(
  payload: ClientApplePurchasePayload,
): Promise<VerifiedApplePurchase> {
  assertAppleIapConfigured();

  const signedTransactionInfo = payload.signedTransactionInfo?.trim();
  const transactionId = payload.transactionId?.trim();

  if (!signedTransactionInfo && !transactionId) {
    throw new ApplePurchaseVerificationError(
      "A signed Apple transaction or transaction id is required.",
      "missing_verification_material",
      400,
    );
  }

  const verified = signedTransactionInfo
    ? await verifyAndDecodeSignedTransaction(signedTransactionInfo)
    : await fetchVerifiedTransactionById(transactionId!);

  const mapped = mapDecodedTransactionToVerifiedPurchase(
    verified.transaction,
    verified.environment,
  );

  // Optional soft consistency checks against client hints (never used as source of truth).
  const claimedProduct = payload.productId?.trim();
  if (claimedProduct && claimedProduct !== mapped.productId) {
    throw new ApplePurchaseVerificationError(
      "Client product id does not match the verified Apple transaction.",
      "product_mismatch",
      400,
    );
  }

  const claimedOriginal = payload.originalTransactionId?.trim();
  if (claimedOriginal && claimedOriginal !== mapped.originalTransactionId) {
    throw new ApplePurchaseVerificationError(
      "Client original transaction id does not match the verified Apple transaction.",
      "original_transaction_mismatch",
      400,
    );
  }

  return mapped;
}

export async function verifyAndSyncApplePurchaseForUser(input: {
  userId: string;
  payload: ClientApplePurchasePayload;
}): Promise<{ plan: IapPlan; status: string; verified: VerifiedApplePurchase }> {
  const verified = await verifyClientApplePurchase(input.payload);

  // If Apple says revoked/expired, clear rather than grant (defense in depth).
  if (verified.revocationDate) {
    await clearAppleSubscriptionOnProfile(input.userId);
    throw new ApplePurchaseVerificationError(
      "This Apple purchase was revoked and cannot unlock Premium.",
      "revoked",
      400,
    );
  }

  const synced = await syncVerifiedAppleSubscriptionToProfile({
    userId: input.userId,
    productId: verified.productId,
    originalTransactionId: verified.originalTransactionId,
    transactionId: verified.transactionId,
    expiresAt: verified.expiresAt,
    environment: verified.environment,
    status: "active",
  });

  return {
    plan: synced.plan as IapPlan,
    status: synced.status,
    verified,
  };
}

export function decodePlanHint(productId: string | null | undefined) {
  return planFromVerifiedAppleProduct(productId);
}
