"use client";

import { NativePurchases, PURCHASE_TYPE } from "@capgo/native-purchases";
import { isNativeIos } from "@/lib/native/platform";
import {
  IAP_PRODUCTS,
  type IapPlan,
  planFromIapProductId,
} from "@/lib/iap/products";

export type NativePurchaseResult = {
  productId: string;
  plan: IapPlan;
  transactionId: string | null;
  receipt: string | null;
  originalTransactionId: string | null;
};

function mapTransaction(item: {
  productIdentifier?: string;
  transactionId?: string;
  receipt?: string;
  originalId?: string;
}): NativePurchaseResult | null {
  const productId = item.productIdentifier;
  if (!productId) {
    return null;
  }

  const plan = planFromIapProductId(productId);
  if (!plan) {
    return null;
  }

  return {
    productId,
    plan,
    transactionId: item.transactionId ?? null,
    receipt: item.receipt ?? null,
    originalTransactionId: item.originalId ?? item.transactionId ?? null,
  };
}

export async function purchaseNativePlan(
  plan: IapPlan,
): Promise<NativePurchaseResult> {
  if (!isNativeIos()) {
    throw new Error("In-app purchases are only available in the iOS app.");
  }

  const productId = IAP_PRODUCTS[plan].productId;
  const result = await NativePurchases.purchaseProduct({
    productIdentifier: productId,
    productType: PURCHASE_TYPE.SUBS,
  });

  const mapped = mapTransaction(result);
  if (!mapped) {
    throw new Error("Purchase completed but product mapping failed.");
  }

  return mapped;
}

export async function restoreNativePurchases(): Promise<NativePurchaseResult[]> {
  if (!isNativeIos()) {
    throw new Error("Restore purchases is only available in the iOS app.");
  }

  await NativePurchases.restorePurchases();
  const { purchases } = await NativePurchases.getPurchases({
    productType: PURCHASE_TYPE.SUBS,
  });

  return purchases
    .map((purchase) => mapTransaction(purchase))
    .filter((item): item is NativePurchaseResult => Boolean(item));
}
