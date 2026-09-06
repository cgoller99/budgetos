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
  listAppleOwnersOfOriginalTransaction,
  releaseInactiveAppleOriginalTransaction,
  syncVerifiedAppleSubscriptionToProfile,
} from "@/lib/iap/appleSubscriptionService";
import type { IapPlan } from "@/lib/iap/products";
import { APIException } from "@apple/app-store-server-library";

export type AppleAppAccountTokenRebindDecision = {
  /** Deployed server path marker — proves PR #66+ rebind code ran. */
  codePath: "apple_app_account_token_rebind_v1";
  appAccountTokenSent: string | null;
  appleAppAccountToken: string | null;
  rebindEligible: boolean;
  rebindAttempted: boolean;
  rebindSucceeded: boolean;
  blockedReason:
    | null
    | "missing_app_account_token_sent"
    | "app_account_token_sent_mismatch"
    | "active_otid_owner"
    | "apple_set_app_account_token_failed"
    | "invalid_user_id";
  activeOwnerUserId: string | null;
  inactiveOwnerUserIds: string[];
  appleSetTokenHttpStatus: number | null;
  appleSetTokenApiError: string | null;
  appleSetTokenEnvironment: string | null;
  postRebindRefreshAttempted: boolean;
  postRebindAppleToken: string | null;
};

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
  appAccountTokenSent?: string | null;
  rebind?: AppleAppAccountTokenRebindDecision;
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

function emptyRebindDecision(
  partial: Partial<AppleAppAccountTokenRebindDecision> & {
    appAccountTokenSent: string | null;
    appleAppAccountToken: string | null;
  },
): AppleAppAccountTokenRebindDecision {
  return {
    codePath: "apple_app_account_token_rebind_v1",
    appAccountTokenSent: partial.appAccountTokenSent,
    appleAppAccountToken: partial.appleAppAccountToken,
    rebindEligible: partial.rebindEligible ?? false,
    rebindAttempted: partial.rebindAttempted ?? false,
    rebindSucceeded: partial.rebindSucceeded ?? false,
    blockedReason: partial.blockedReason ?? null,
    activeOwnerUserId: partial.activeOwnerUserId ?? null,
    inactiveOwnerUserIds: partial.inactiveOwnerUserIds ?? [],
    appleSetTokenHttpStatus: partial.appleSetTokenHttpStatus ?? null,
    appleSetTokenApiError: partial.appleSetTokenApiError ?? null,
    appleSetTokenEnvironment: partial.appleSetTokenEnvironment ?? null,
    postRebindRefreshAttempted: partial.postRebindRefreshAttempted ?? false,
    postRebindAppleToken: partial.postRebindAppleToken ?? null,
  };
}

function describeAppleApiError(error: unknown): {
  message: string;
  httpStatus: number | null;
  apiError: string | null;
} {
  if (error instanceof APIException) {
    return {
      message: error.message || `Apple APIException HTTP ${error.httpStatusCode}`,
      httpStatus: error.httpStatusCode,
      apiError:
        error.apiError != null
          ? String(error.apiError)
          : error.errorMessage ?? null,
    };
  }
  if (error instanceof Error) {
    return { message: error.message, httpStatus: null, apiError: null };
  }
  return { message: String(error), httpStatus: null, apiError: null };
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

  const owners = await listAppleOwnersOfOriginalTransaction({
    originalTransactionId: input.verified.originalTransactionId,
    excludeUserId: input.userId,
  });
  const activeOwner = owners.find((owner) => owner.isActiveAppleEntitlement);
  const inactiveOwnerUserIds = owners
    .filter((owner) => !owner.isActiveAppleEntitlement)
    .map((owner) => owner.id);

  console.info("[iap/apple/verify] appAccountToken mismatch on purchase", {
    codePath: "apple_app_account_token_rebind_v1",
    authenticatedUserId: input.userId,
    appAccountTokenSent: sent,
    appleAppAccountToken: appleToken,
    productId: input.verified.productId,
    transactionId: input.verified.transactionId,
    originalTransactionId: input.verified.originalTransactionId,
    environment: input.verified.environment,
    purchaseDateMs: input.verified.purchaseDateMs,
    originalPurchaseDateMs: input.verified.originalPurchaseDateMs,
    otidOwners: owners,
  });

  if (sent.toLowerCase() !== input.userId.toLowerCase()) {
    const rebind = emptyRebindDecision({
      appAccountTokenSent: sent,
      appleAppAccountToken: appleToken,
      blockedReason: "app_account_token_sent_mismatch",
      activeOwnerUserId: activeOwner?.id ?? null,
      inactiveOwnerUserIds,
    });
    console.info("[iap/apple/verify] rebind blocked", rebind);
    throw new ApplePurchaseVerificationError(
      "This Apple purchase is bound to a different Buxme account.",
      "app_account_token_mismatch",
      403,
      buildOwnershipDetails(input.userId, input.verified, {
        appAccountToken: appleToken,
        appAccountTokenSent: sent,
        rebind,
      }),
    );
  }

  if (activeOwner) {
    const rebind = emptyRebindDecision({
      appAccountTokenSent: sent,
      appleAppAccountToken: appleToken,
      rebindEligible: false,
      blockedReason: "active_otid_owner",
      activeOwnerUserId: activeOwner.id,
      inactiveOwnerUserIds,
    });
    console.info("[iap/apple/verify] rebind blocked", rebind);
    throw new ApplePurchaseVerificationError(
      "This Apple purchase is bound to a different Buxme account.",
      "app_account_token_mismatch",
      403,
      buildOwnershipDetails(input.userId, input.verified, {
        appAccountToken: appleToken,
        appAccountTokenSent: sent,
        rebind,
      }),
    );
  }

  // Release stale local OTID mirrors on inactive Free profiles so sync can
  // first-link this lineage to the purchaser after Apple rebind.
  await releaseInactiveAppleOriginalTransaction({
    originalTransactionId: input.verified.originalTransactionId,
    excludeUserId: input.userId,
  });

  let setTokenEnvironment: string | null = null;
  try {
    const setResult = await setAppleAppAccountToken({
      originalTransactionId: input.verified.originalTransactionId,
      appAccountToken: input.userId,
      preferredEnvironment: input.verified.environment,
    });
    setTokenEnvironment = String(setResult.environment);
    console.info("[iap/apple/verify] setAppAccountToken succeeded", {
      authenticatedUserId: input.userId,
      originalTransactionId: input.verified.originalTransactionId,
      environment: setTokenEnvironment,
      appleAppAccountTokenBefore: appleToken,
    });
  } catch (error) {
    const appleError = describeAppleApiError(error);
    const rebind = emptyRebindDecision({
      appAccountTokenSent: sent,
      appleAppAccountToken: appleToken,
      rebindEligible: true,
      rebindAttempted: true,
      blockedReason: "apple_set_app_account_token_failed",
      activeOwnerUserId: null,
      inactiveOwnerUserIds,
      appleSetTokenHttpStatus: appleError.httpStatus,
      appleSetTokenApiError: appleError.apiError ?? appleError.message,
    });
    console.error("[iap/apple/verify] setAppAccountToken failed", {
      ...rebind,
      error: appleError.message,
    });
    throw new ApplePurchaseVerificationError(
      "This Apple purchase is bound to a different Buxme account.",
      "app_account_token_mismatch",
      403,
      buildOwnershipDetails(input.userId, input.verified, {
        appAccountToken: appleToken,
        appAccountTokenSent: sent,
        rebind,
      }),
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
  let postRebindRefreshAttempted = false;
  let postRebindAppleToken: string | null = null;

  try {
    postRebindRefreshAttempted = true;
    const fresh = await fetchVerifiedTransactionById(input.verified.transactionId);
    const remapped = mapDecodedTransactionToVerifiedPurchase(
      fresh.transaction,
      fresh.environment,
    );
    postRebindAppleToken = remapped.appAccountToken;
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

  const rebind = emptyRebindDecision({
    appAccountTokenSent: sent,
    appleAppAccountToken: appleToken,
    rebindEligible: true,
    rebindAttempted: true,
    rebindSucceeded: true,
    blockedReason: null,
    inactiveOwnerUserIds,
    appleSetTokenEnvironment: setTokenEnvironment,
    postRebindRefreshAttempted,
    postRebindAppleToken,
  });

  console.info("[iap/apple/verify] appAccountToken rebound to authenticated user", {
    ...rebind,
    authenticatedUserId: input.userId,
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
    codePath: "apple_app_account_token_rebind_v1",
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
    const tokenSentRaw = input.payload.appAccountTokenSent?.trim() || "";
    const tokenSent = tokenSentRaw || null;
    const canAttemptRebind =
      ownership.reason === "app_account_token_mismatch" &&
      isBuxmeUserUuid(tokenSentRaw) &&
      tokenSentRaw.toLowerCase() === input.userId.toLowerCase();

    if (!canAttemptRebind) {
      const blockedReason =
        ownership.reason === "invalid_user_id"
          ? "invalid_user_id"
          : !tokenSentRaw
            ? "missing_app_account_token_sent"
            : tokenSentRaw.toLowerCase() !== input.userId.toLowerCase()
              ? "app_account_token_sent_mismatch"
              : "missing_app_account_token_sent";

      let inactiveOwnerUserIds: string[] = [];
      let activeOwnerUserId: string | null = null;
      try {
        const owners = await listAppleOwnersOfOriginalTransaction({
          originalTransactionId: verified.originalTransactionId,
          excludeUserId: input.userId,
        });
        activeOwnerUserId =
          owners.find((owner) => owner.isActiveAppleEntitlement)?.id ?? null;
        inactiveOwnerUserIds = owners
          .filter((owner) => !owner.isActiveAppleEntitlement)
          .map((owner) => owner.id);
      } catch (error) {
        console.warn(
          "[iap/apple/verify] OTID owner lookup failed during mismatch diagnostics",
          error instanceof Error ? error.message : String(error),
        );
      }

      const rebind = emptyRebindDecision({
        appAccountTokenSent: tokenSent,
        appleAppAccountToken: verified.appAccountToken,
        blockedReason,
        activeOwnerUserId,
        inactiveOwnerUserIds,
      });
      console.info("[iap/apple/verify] rebind not eligible", rebind);

      throw new ApplePurchaseVerificationError(
        ownership.reason === "app_account_token_mismatch"
          ? "This Apple purchase is bound to a different Buxme account."
          : "Authenticated user id is invalid for Apple purchase linking.",
        ownership.reason,
        403,
        buildOwnershipDetails(input.userId, verified, {
          appAccountTokenSent: tokenSent,
          rebind,
        }),
      );
    }

    verified = await rebindStaleAppAccountTokenForPurchase({
      userId: input.userId,
      verified,
      appAccountTokenSent: tokenSentRaw,
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
