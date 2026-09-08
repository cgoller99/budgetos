import "server-only";

import type { Environment } from "@apple/app-store-server-library";
import { mapAppleNotificationToAction } from "@/lib/iap/appleEntitlementPolicy";
import {
  verifyAndDecodeNotificationPayload,
  verifyAndDecodeSignedTransaction,
} from "@/lib/iap/appleServerClient";
import { applyAppleSubscriptionByOriginalTransaction } from "@/lib/iap/appleSubscriptionService";
import { getAppleIapConfig } from "@/lib/iap/config";

export type AppleNotificationHandleResult = {
  ok: true;
  notificationType: string | null;
  subtype: string | null;
  action: string;
  updated: boolean;
  skippedReason?: string;
  userId?: string;
  environment: string;
  notificationUUID?: string | null;
};

function toIsoFromMs(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  return new Date(value).toISOString();
}

/**
 * Verifies and applies an App Store Server Notification V2 payload.
 * Idempotent: repeating the same notification converges on the same profile state.
 */
export async function handleAppleServerNotificationV2(
  signedPayload: string,
): Promise<AppleNotificationHandleResult> {
  const { notification, environment } =
    await verifyAndDecodeNotificationPayload(signedPayload);

  const notificationType = notification.notificationType ?? null;
  const subtype = notification.subtype ?? null;
  const action = mapAppleNotificationToAction({
    notificationType,
    subtype,
  });

  if (action.kind === "ignore") {
    return {
      ok: true,
      notificationType,
      subtype,
      action: action.reason,
      updated: false,
      skippedReason: action.reason,
      environment: String(environment),
      notificationUUID: notification.notificationUUID ?? null,
    };
  }

  const signedTransactionInfo = notification.data?.signedTransactionInfo;
  if (!signedTransactionInfo) {
    return {
      ok: true,
      notificationType,
      subtype,
      action: action.kind,
      updated: false,
      skippedReason: "missing_signed_transaction",
      environment: String(environment),
      notificationUUID: notification.notificationUUID ?? null,
    };
  }

  // Prefer decoding with the notification environment; fall back via helper.
  let transactionEnvironment: Environment | string = environment;
  let transaction;
  try {
    const verified = await verifyAndDecodeSignedTransaction(signedTransactionInfo);
    transaction = verified.transaction;
    transactionEnvironment = verified.environment;
  } catch (error) {
    throw error;
  }

  const config = getAppleIapConfig();
  if (transaction.bundleId !== config.bundleId) {
    return {
      ok: true,
      notificationType,
      subtype,
      action: action.kind,
      updated: false,
      skippedReason: "bundle_mismatch",
      environment: String(transactionEnvironment),
      notificationUUID: notification.notificationUUID ?? null,
    };
  }

  const originalTransactionId = transaction.originalTransactionId;
  const productId = transaction.productId;

  if (!originalTransactionId || !productId) {
    return {
      ok: true,
      notificationType,
      subtype,
      action: action.kind,
      updated: false,
      skippedReason: "missing_transaction_fields",
      environment: String(transactionEnvironment),
      notificationUUID: notification.notificationUUID ?? null,
    };
  }

  const result = await applyAppleSubscriptionByOriginalTransaction({
    originalTransactionId,
    productId,
    transactionId: transaction.transactionId ?? null,
    expiresAt: toIsoFromMs(transaction.expiresDate),
    environment: String(transactionEnvironment),
    status: action.kind === "deactivate" ? "canceled" : action.status,
  });

  return {
    ok: true,
    notificationType,
    subtype,
    action: action.kind,
    updated: result.updated,
    skippedReason: result.skippedReason,
    userId: result.userId,
    environment: String(transactionEnvironment),
    notificationUUID: notification.notificationUUID ?? null,
  };
}
