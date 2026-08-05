"use client";

import type { IapPlan } from "@/lib/iap/products";
import type { NativePurchaseResult } from "@/lib/iap/nativePurchases";

type VerifyResponse = {
  ok?: boolean;
  error?: string;
  subscription?: { plan: string; status: string };
};

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
      receipt: purchase.receipt,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as VerifyResponse;

  if (!response.ok) {
    throw new Error(body.error ?? "Unable to verify Apple purchase.");
  }

  return body;
}

export async function purchaseAndVerifyNativePlan(plan: IapPlan) {
  const { purchaseNativePlan } = await import("@/lib/iap/nativePurchases");
  const purchase = await purchaseNativePlan(plan);
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

  await verifyApplePurchase(preferred);
  return { restored: purchases.length, plan: preferred.plan };
}
