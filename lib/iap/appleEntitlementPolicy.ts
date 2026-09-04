/**
 * Pure Apple entitlement policy helpers (safe for unit tests without Apple credentials).
 */

import { planFromIapProductId, type IapPlan } from "@/lib/iap/products";
import type { SubscriptionStatus } from "@/lib/subscription/types";

export type AppleNotificationAction =
  | {
      kind: "upsert";
      status: Extract<SubscriptionStatus, "active" | "past_due">;
    }
  | {
      kind: "deactivate";
      status: Extract<SubscriptionStatus, "canceled">;
    }
  | {
      kind: "ignore";
      reason: string;
    };

export type AppleProfileBillingSnapshot = {
  id: string;
  subscriptionProvider: string | null | undefined;
  subscriptionStatus: string | null | undefined;
  stripeSubscriptionId: string | null | undefined;
  appleOriginalTransactionId: string | null | undefined;
};

/** StoreKit / Capgo require a UUID-shaped appAccountToken on iOS. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isBuxmeUserUuid(value: string | null | undefined): boolean {
  return Boolean(value && UUID_RE.test(value));
}

/**
 * Ownership binding for verified Apple transactions.
 *
 * - NEW purchases: client passes authenticated Buxme user UUID as StoreKit appAccountToken.
 *   When Apple returns appAccountToken, it MUST match the authenticated user.
 * - LEGACY / RESTORE: transactions created before binding may omit appAccountToken.
 *   Those may first-link to the verifying user only after full Apple crypto verification
 *   and only if originalTransactionId is not already owned by another Buxme account.
 */
export function resolveAppAccountTokenOwnership(input: {
  authenticatedUserId: string;
  appAccountToken: string | null | undefined;
}):
  | { allowed: true; mode: "bound" | "legacy_absent" }
  | { allowed: false; reason: "invalid_user_id" | "app_account_token_mismatch" } {
  if (!isBuxmeUserUuid(input.authenticatedUserId)) {
    return { allowed: false, reason: "invalid_user_id" };
  }

  const token = input.appAccountToken?.trim();
  if (!token) {
    return { allowed: true, mode: "legacy_absent" };
  }

  if (token.toLowerCase() !== input.authenticatedUserId.toLowerCase()) {
    return { allowed: false, reason: "app_account_token_mismatch" };
  }

  return { allowed: true, mode: "bound" };
}

export function isAllowedAppleProductId(productId: string | null | undefined): boolean {
  return Boolean(productId && planFromIapProductId(productId));
}

export function planFromVerifiedAppleProduct(
  productId: string | null | undefined,
): IapPlan | null {
  if (!productId) {
    return null;
  }

  return planFromIapProductId(productId);
}

export function isStripeSubscriptionActiveOnProfile(
  profile: Pick<
    AppleProfileBillingSnapshot,
    "subscriptionProvider" | "subscriptionStatus" | "stripeSubscriptionId"
  >,
): boolean {
  const status = profile.subscriptionStatus ?? "none";
  const statusActive =
    status === "active" || status === "trialing" || status === "past_due";

  if (!statusActive) {
    return false;
  }

  return (
    profile.subscriptionProvider === "stripe" ||
    Boolean(profile.stripeSubscriptionId)
  );
}

/**
 * ASN / Apple sync must never overwrite an active Stripe-billed entitlement.
 */
export function canApplyAppleEntitlementToProfile(
  profile: AppleProfileBillingSnapshot,
): boolean {
  return !isStripeSubscriptionActiveOnProfile(profile);
}

export function isVerifiedAppleTransactionCurrentlyValid(input: {
  productId: string | null | undefined;
  bundleId: string | null | undefined;
  expectedBundleId: string;
  expiresDateMs: number | null | undefined;
  revocationDateMs: number | null | undefined;
  nowMs?: number;
}): { valid: boolean; reason?: string; plan?: IapPlan } {
  const now = input.nowMs ?? Date.now();

  if (input.bundleId !== input.expectedBundleId) {
    return { valid: false, reason: "bundle_mismatch" };
  }

  const plan = planFromVerifiedAppleProduct(input.productId);
  if (!plan) {
    return { valid: false, reason: "unsupported_product" };
  }

  if (input.revocationDateMs != null) {
    return { valid: false, reason: "revoked" };
  }

  if (input.expiresDateMs == null) {
    return { valid: false, reason: "missing_expiry" };
  }

  if (input.expiresDateMs <= now) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, plan };
}

export function mapAppleNotificationToAction(input: {
  notificationType: string | null | undefined;
  subtype?: string | null | undefined;
}): AppleNotificationAction {
  const type = input.notificationType ?? "";
  const subtype = input.subtype ?? "";

  switch (type) {
    case "SUBSCRIBED":
    case "DID_RENEW":
    case "OFFER_REDEEMED":
    case "RENEWAL_EXTENDED":
    case "REFUND_REVERSED":
    case "DID_CHANGE_RENEWAL_PREF":
      return { kind: "upsert", status: "active" };

    case "DID_FAIL_TO_RENEW":
      if (subtype === "GRACE_PERIOD" || subtype === "BILLING_RETRY") {
        return { kind: "upsert", status: "past_due" };
      }
      return { kind: "upsert", status: "past_due" };

    case "EXPIRED":
    case "GRACE_PERIOD_EXPIRED":
    case "REFUND":
    case "REVOKE":
      return { kind: "deactivate", status: "canceled" };

    case "DID_CHANGE_RENEWAL_STATUS":
      // Auto-renew off still keeps access until expiresDate — keep current entitlement.
      return { kind: "ignore", reason: "renewal_status_only" };

    case "TEST":
      return { kind: "ignore", reason: "test_notification" };

    case "CONSUMPTION_REQUEST":
    case "PRICE_INCREASE":
    case "REFUND_DECLINED":
      return { kind: "ignore", reason: `unhandled_${type.toLowerCase()}` };

    default:
      return { kind: "ignore", reason: `unknown_${type || "empty"}` };
  }
}
