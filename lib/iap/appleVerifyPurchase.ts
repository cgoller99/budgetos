import "server-only";

import type { Environment, JWSTransactionDecodedPayload } from "@apple/app-store-server-library";
import {
  getAppleIapConfig,
  assertAppleIapConfigured,
} from "@/lib/iap/config";
import {
  isBuxmeUserUuid,
  isVerifiedAppleTransactionCurrentlyValid,
  planFromVerifiedAppleProduct,
  resolveAppAccountTokenOwnership,
} from "@/lib/iap/appleEntitlementPolicy";
import {
  fetchVerifiedTransactionById,
  setAppleAppAccountToken,
  verifyAndDecodeSignedTransaction,
} from "@/lib/iap/appleServerClient";
import {
  clearAppleSubscriptionOnProfile,
  findActiveAppleOwnerOfOriginalTransaction,
  releaseInactiveAppleOriginalTransaction,
  syncVerifiedAppleSubscriptionToProfile,
} from "@/lib/iap/appleSubscriptionService";
import type { IapPlan } from "@/lib/iap/products";

export type ApplePurchaseVerificationDetails = {
  authenticatedUserId?: string;
  appAccountToken?: string | null;
  originalTransactionId?: string;
  transactionId?: string;
  productId?: string;
  environment?: string;
  purchaseDateMs?: number | null;
  originalPurchaseDateMs?: number | null;
  lineage?: "original" | "continuation" | "unknown";
};

export class ApplePurchaseVerificationError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: ApplePurchaseVerificationDetails | undefined;

  constructor(
    message: string,
    code: string,
    status = 400,
    details?: ApplePurchaseVerificationDetails,
  ) {
    super(message);
    this.name = "ApplePurchaseVerificationError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function describeTransactionLineage(input: {
  transactionId: string;
  originalTransactionId: string;
  purchaseDateMs?: number | null;
  originalPurchaseDateMs?: number | null;
}): "original" | "continuation" | "unknown" {
  if (
    input.transactionId &&
    input.originalTransactionId &&
    input.transactionId !== input.originalTransactionId
  ) {
    return "continuation";
  }

  if (
    input.purchaseDateMs != null &&
    input.originalPurchaseDateMs != null &&
    input.purchaseDateMs !== input.originalPurchaseDateMs
  ) {
    return "continuation";
  }

  if (
    input.transactionId &&
    input.originalTransactionId &&
    input.transactionId === input.originalTransactionId
  ) {
    return "original";
  }

  return "unknown";
}

export type ClientApplePurchasePayload = {
  productId?: string | null;
  transactionId?: string | null;
  originalTransactionId?: string | null;
  signedTransactionInfo?: string | null;
  environment?: string | null;
  /**
   * UUID the client passed into StoreKit `purchaseProduct({ appAccountToken })`.
   * Present only on new-purchase verify (not restore). When Apple returns a
   * stale lineage token, this proves the current user attempted to bind
   * themselves and authorizes App Store Server API rebind.
   */
  appAccountTokenSent?: string | null;
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
  appAccountToken: string | null;
  purchaseDateMs: number | null;
  originalPurchaseDateMs: number | null;
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
    appAccountToken: transaction.appAccountToken?.trim() || null,
    purchaseDateMs:
      typeof transaction.purchaseDate === "number" ? transaction.purchaseDate : null,
    originalPurchaseDateMs:
      typeof transaction.originalPurchaseDate === "number"
        ? transaction.originalPurchaseDate
        : null,
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

  // Soft-check originalTransactionId only when the client sent an explicit
  // value that differs. Capgo historically omitted originalId and some clients
  // incorrectly sent transactionId; when signedTransactionInfo is present the
  // verified JWS is already the source of truth, so skip this hint check.
  const claimedOriginal = payload.originalTransactionId?.trim();
  const verifiedViaJws = Boolean(signedTransactionInfo);
  if (
    !verifiedViaJws &&
    claimedOriginal &&
    claimedOriginal !== mapped.originalTransactionId
  ) {
    throw new ApplePurchaseVerificationError(
      "Client original transaction id does not match the verified Apple transaction.",
      "original_transaction_mismatch",
      400,
    );
  }

  return mapped;
}

function buildOwnershipDetails(
  userId: string,
  verified: VerifiedApplePurchase,
  extras?: Partial<ApplePurchaseVerificationDetails>,
): ApplePurchaseVerificationDetails {
  return {
    authenticatedUserId: userId,
    appAccountToken: verified.appAccountToken,
    originalTransactionId: verified.originalTransactionId,
    transactionId: verified.transactionId,
    productId: verified.productId,
    environment: verified.environment,
    purchaseDateMs: verified.purchaseDateMs,
    originalPurchaseDateMs: verified.originalPurchaseDateMs,
    lineage: describeTransactionLineage({
      transactionId: verified.transactionId,
      originalTransactionId: verified.originalTransactionId,
      purchaseDateMs: verified.purchaseDateMs,
      originalPurchaseDateMs: verified.originalPurchaseDateMs,
    }),
    ...extras,
  };
}

/**
 * StoreKit often returns an existing subscription lineage whose signed
 * appAccountToken was bound at an earlier purchase — even when the client just
 * passed the current Buxme UUID into purchaseProduct. Apple does not rewrite
 * that token on repurchase; App Store Server API `Set App Account Token` does.
 *
 * Only allowed when:
 * - crypto verification already succeeded
 * - client proves it sent the authenticated user's UUID into StoreKit
 * - no *other* Buxme profile currently holds an active Apple entitlement on this OTID
 */
async function rebindStaleAppAccountTokenForPurchase(input: {
  userId: string;
  verified: VerifiedApplePurchase;
  appAccountTokenSent: string;
}): Promise<VerifiedApplePurchase> {
  const sent = input.appAccountTokenSent.trim();
  const appleToken = input.verified.appAccountToken?.trim() || null;

  console.info("[iap/apple/verify] appAccountToken mismatch on purchase", {
    authenticatedUserId: input.userId,
    appAccountTokenSent: sent,
    appleAppAccountToken: appleToken,
    productId: input.verified.productId,
    transactionId: input.verified.transactionId,
    originalTransactionId: input.verified.originalTransactionId,
    environment: input.verified.environment,
    purchaseDateMs: input.verified.purchaseDateMs,
    originalPurchaseDateMs: input.verified.originalPurchaseDateMs,
  });

  if (sent.toLowerCase() !== input.userId.toLowerCase()) {
    throw new ApplePurchaseVerificationError(
      "This Apple purchase is bound to a different Buxme account.",
      "app_account_token_mismatch",
      403,
      buildOwnershipDetails(input.userId, input.verified, {
        appAccountToken: appleToken,
      }),
    );
  }

  const activeOwner = await findActiveAppleOwnerOfOriginalTransaction({
    originalTransactionId: input.verified.originalTransactionId,
    excludeUserId: input.userId,
  });

  if (activeOwner) {
    throw new ApplePurchaseVerificationError(
      "This Apple purchase is bound to a different Buxme account.",
      "app_account_token_mismatch",
      403,
      buildOwnershipDetails(input.userId, input.verified, {
        appAccountToken: appleToken,
      }),
    );
  }

  // Release stale local OTID mirrors on inactive Free profiles so sync can
  // first-link this lineage to the purchaser after Apple rebind.
  await releaseInactiveAppleOriginalTransaction({
    originalTransactionId: input.verified.originalTransactionId,
    excludeUserId: input.userId,
  });

  try {
    await setAppleAppAccountToken({
      originalTransactionId: input.verified.originalTransactionId,
      appAccountToken: input.userId,
      preferredEnvironment: input.verified.environment,
    });
  } catch (error) {
    console.error("[iap/apple/verify] setAppAccountToken failed", {
      authenticatedUserId: input.userId,
      appleAppAccountToken: appleToken,
      originalTransactionId: input.verified.originalTransactionId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new ApplePurchaseVerificationError(
      "This Apple purchase is bound to a different Buxme account.",
      "app_account_token_mismatch",
      403,
      buildOwnershipDetails(input.userId, input.verified),
    );
  }

  // Historical JWS snapshots keep the pre-rebind token. Prefer a fresh App
  // Store Server API read; if Apple still returns the old snapshot, treat a
  // successful Set App Account Token as the ownership source of truth for
  // *this* authenticated purchaser (OTID uniqueness already enforced).
  let rebound: VerifiedApplePurchase = {
    ...input.verified,
    appAccountToken: input.userId,
  };

  try {
    const fresh = await fetchVerifiedTransactionById(input.verified.transactionId);
    const remapped = mapDecodedTransactionToVerifiedPurchase(
      fresh.transaction,
      fresh.environment,
    );
    rebound = {
      ...remapped,
      appAccountToken:
        remapped.appAccountToken?.toLowerCase() === input.userId.toLowerCase()
          ? remapped.appAccountToken
          : input.userId,
    };
  } catch (error) {
    console.warn(
      "[iap/apple/verify] post-rebind transaction refresh failed; continuing with Set App Account Token success",
      error instanceof Error ? error.message : String(error),
    );
  }

  console.info("[iap/apple/verify] appAccountToken rebound to authenticated user", {
    authenticatedUserId: input.userId,
    appAccountTokenSent: sent,
    appleAppAccountTokenBefore: appleToken,
    appleAppAccountTokenAfter: rebound.appAccountToken,
    productId: rebound.productId,
    transactionId: rebound.transactionId,
    originalTransactionId: rebound.originalTransactionId,
    environment: rebound.environment,
  });

  return rebound;
}

export async function verifyAndSyncApplePurchaseForUser(input: {
  userId: string;
  payload: ClientApplePurchasePayload;
}): Promise<{ plan: IapPlan; status: string; verified: VerifiedApplePurchase }> {
  let verified = await verifyClientApplePurchase(input.payload);

  console.info("[iap/apple/verify] verified Apple transaction", {
    authenticatedUserId: input.userId,
    appAccountTokenSent: input.payload.appAccountTokenSent ?? null,
    appleAppAccountToken: verified.appAccountToken,
    productId: verified.productId,
    transactionId: verified.transactionId,
    originalTransactionId: verified.originalTransactionId,
    environment: verified.environment,
  });

  const ownership = resolveAppAccountTokenOwnership({
    authenticatedUserId: input.userId,
    appAccountToken: verified.appAccountToken,
  });

  if (!ownership.allowed) {
    const tokenSent = input.payload.appAccountTokenSent?.trim() || "";
    const canAttemptRebind =
      ownership.reason === "app_account_token_mismatch" &&
      isBuxmeUserUuid(tokenSent) &&
      tokenSent.toLowerCase() === input.userId.toLowerCase();

    if (!canAttemptRebind) {
      throw new ApplePurchaseVerificationError(
        ownership.reason === "app_account_token_mismatch"
          ? "This Apple purchase is bound to a different Buxme account."
          : "Authenticated user id is invalid for Apple purchase linking.",
        ownership.reason,
        403,
        buildOwnershipDetails(input.userId, verified),
      );
    }

    verified = await rebindStaleAppAccountTokenForPurchase({
      userId: input.userId,
      verified,
      appAccountTokenSent: tokenSent,
    });
  }

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
