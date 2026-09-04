"use client";

import { NativePurchases, PURCHASE_TYPE } from "@capgo/native-purchases";
import { isNativeIos } from "@/lib/native/platform";
import { isBuxmeUserUuid } from "@/lib/iap/appleEntitlementPolicy";
import {
  IAP_PRODUCT_IDS,
  IAP_PRODUCTS,
  type IapPlan,
  planFromIapProductId,
} from "@/lib/iap/products";

export type NativePurchaseResult = {
  productId: string;
  plan: IapPlan;
  transactionId: string | null;
  originalTransactionId: string | null;
  signedTransactionInfo: string | null;
  expiresAt: string | null;
  appAccountToken: string | null;
};

export type NativeStoreProduct = {
  productId: string;
  plan: IapPlan;
  title: string;
  description: string;
  priceString: string;
  price: number;
  currencyCode: string;
};

function mapTransaction(item: {
  productIdentifier?: string;
  transactionId?: string;
  originalId?: string;
  jwsRepresentation?: string;
  expirationDate?: string;
  appAccountToken?: string | null;
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
    originalTransactionId: item.originalId ?? item.transactionId ?? null,
    signedTransactionInfo: item.jwsRepresentation ?? null,
    expiresAt: item.expirationDate ?? null,
    appAccountToken: item.appAccountToken?.trim() || null,
  };
}

/**
 * Loads StoreKit localized product metadata (title + priceString) for the iOS purchase UI.
 * Apple requires displaying App Store-provided prices rather than hardcoding.
 */
export async function getNativeStoreProducts(): Promise<NativeStoreProduct[]> {
  if (!isNativeIos()) {
    return [];
  }

  const { products } = await NativePurchases.getProducts({
    productIdentifiers: [...IAP_PRODUCT_IDS],
    productType: PURCHASE_TYPE.SUBS,
  });

  return products
    .map((product) => {
      const plan = planFromIapProductId(product.identifier);
      if (!plan) {
        return null;
      }

      return {
        productId: product.identifier,
        plan,
        title: product.title,
        description: product.description,
        priceString: product.priceString,
        price: product.price,
        currencyCode: product.currencyCode,
      } satisfies NativeStoreProduct;
    })
    .filter((item): item is NativeStoreProduct => Boolean(item));
}

/**
 * Starts a new Apple subscription purchase bound to the authenticated Buxme user UUID
 * via StoreKit appAccountToken (supported by @capgo/native-purchases purchaseProduct).
 */
export async function purchaseNativePlan(
  plan: IapPlan,
  authenticatedUserId: string,
): Promise<NativePurchaseResult> {
  if (!isNativeIos()) {
    throw new Error("In-app purchases are only available in the iOS app.");
  }

  if (!isBuxmeUserUuid(authenticatedUserId)) {
    throw new Error("A valid Buxme user UUID is required for App Store purchases.");
  }

  const productId = IAP_PRODUCTS[plan].productId;
  const result = await NativePurchases.purchaseProduct({
    productIdentifier: productId,
    productType: PURCHASE_TYPE.SUBS,
    appAccountToken: authenticatedUserId,
  });

  const mapped = mapTransaction(result);
  if (!mapped) {
    throw new Error("Purchase completed but product mapping failed.");
  }

  return mapped;
}

/**
 * Restore does not re-bind appAccountToken (legacy transactions may omit it).
 * Server still requires cryptographic verification + originalTransactionId uniqueness.
 */
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
