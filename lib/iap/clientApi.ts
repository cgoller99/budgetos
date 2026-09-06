"use client";

import type { IapPlan } from "@/lib/iap/products";
import type { NativePurchaseResult } from "@/lib/iap/nativePurchases";
import { getSupabaseClient } from "@/lib/supabase/client";

type VerifyResponse = {
  ok?: boolean;
  error?: string;
  code?: string;
  details?: {
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
  subscription?: { plan: string; status: string };
  appleServerVerification?: string;
};

function formatOwnershipMismatchError(body: VerifyResponse): string {
  const details = body.details;
  if (!details) {
    return body.error ?? "Unable to verify Apple purchase.";
  }

  return [
    body.error ?? "This Apple purchase is bound to a different Buxme account.",
    details.authenticatedUserId
      ? `signedInUser=${details.authenticatedUserId}`
      : null,
    details.appAccountToken != null
      ? `appleAppAccountToken=${details.appAccountToken || "(absent)"}`
      : null,
    details.originalTransactionId
      ? `originalTransactionId=${details.originalTransactionId}`
      : null,
    details.transactionId ? `transactionId=${details.transactionId}` : null,
    details.lineage ? `lineage=${details.lineage}` : null,
    details.environment ? `environment=${details.environment}` : null,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function verifyApplePurchase(
  purchase: NativePurchaseResult,
): Promise<VerifyResponse> {
  const response = await fetch("/api/iap/apple/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId: purchase.productId,
      transactionId: purchase.transactionId,
      originalTransactionId: purchase.originalTransactionId,
      signedTransactionInfo: purchase.signedTransactionInfo,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as VerifyResponse;

  if (!response.ok) {
    if (
      body.code === "app_account_token_mismatch" ||
      /bound to a different Buxme account/i.test(body.error ?? "")
    ) {
      throw new Error(formatOwnershipMismatchError(body));
    }
    throw new Error(body.error ?? "Unable to verify Apple purchase.");
  }

  return body;
}

/**
 * Resolves the live Auth user id immediately before StoreKit purchase so a
 * stale React auth snapshot cannot send the wrong appAccountToken.
 */
export async function resolveFreshAuthenticatedUserId(
  fallbackUserId?: string | null,
): Promise<string> {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.id) {
    throw new Error("Sign in to purchase a Buxme subscription.");
  }

  if (fallbackUserId && fallbackUserId !== user.id) {
    console.warn(
      "[iap] AuthContext user id differed from supabase.auth.getUser(); using fresh id for appAccountToken",
      { contextUserId: fallbackUserId, freshUserId: user.id },
    );
  }

  return user.id;
}

export async function purchaseAndVerifyNativePlan(
  plan: IapPlan,
  authenticatedUserId?: string | null,
) {
  const freshUserId = await resolveFreshAuthenticatedUserId(authenticatedUserId);
  const { purchaseNativePlan } = await import("@/lib/iap/nativePurchases");
  const purchase = await purchaseNativePlan(plan, freshUserId);
  return verifyApplePurchase(purchase);
}

export async function restoreAndVerifyNativePurchases() {
  const { restoreNativePurchases } = await import("@/lib/iap/nativePurchases");
  const purchases = await restoreNativePurchases();

  if (purchases.length === 0) {
    return { restored: 0 as const };
  }

  // Prefer the highest plan if multiple entitlements exist.
  const preferred =
    purchases.find((item) => item.plan === "pro_plus") ?? purchases[0];

  // Restore must use the same trusted verification path as purchase.
  // Legacy transactions may omit appAccountToken; server allows that path.
  await verifyApplePurchase(preferred);
  return { restored: purchases.length, plan: preferred.plan };
}
