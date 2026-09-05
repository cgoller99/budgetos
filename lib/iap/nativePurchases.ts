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

/**
 * Capgo's iOS Transaction payload does not include `originalId` /
 * `originalTransactionId`. After renewal, `transactionId` !== Apple's
 * originalTransactionId. Falling back to transactionId causes false
 * `original_transaction_mismatch` failures on restore/renew verify.
 *
 * Prefer Capgo's field when present; otherwise decode the claim from the
 * StoreKit 2 JWS (server still cryptographically verifies the same JWS).
 */
function peekOriginalTransactionIdFromJws(
  jws: string | null | undefined,
): string | null {
  if (!jws) {
    return null;
  }

  try {
    const payloadPart = jws.split(".")[1];
    if (!payloadPart) {
      return null;
    }

    const padded = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padLength = (4 - (padded.length % 4)) % 4;
    const json = atob(padded + "=".repeat(padLength));
    const claims = JSON.parse(json) as {
      originalTransactionId?: string | number;
    };
    return claims.originalTransactionId != null
      ? String(claims.originalTransactionId)
      : null;
  } catch {
    return null;
  }
}

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

  const signedTransactionInfo = item.jwsRepresentation ?? null;
  // Never fall back to transactionId — Capgo omits originalId, and the current
  // transaction id diverges from originalTransactionId after the first renewal.
  const originalTransactionId =
    item.originalId?.trim() ||
    peekOriginalTransactionIdFromJws(signedTransactionInfo) ||
    null;

  return {
    productId,
    plan,
    transactionId: item.transactionId ?? null,
    originalTransactionId,
    signedTransactionInfo,
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

  // Fail fast with a clear message when StoreKit cannot see ASC products.
  // Capgo's purchaseProduct error is easy to miss; this surfaces ASC/capability issues.
  try {
    const billing = await NativePurchases.isBillingSupported();
    if (!billing.isBillingSupported) {
      throw new Error(
        "This device cannot make App Store purchases (billing unsupported).",
      );
    }

    const { products } = await NativePurchases.getProducts({
      productIdentifiers: [productId],
      productType: PURCHASE_TYPE.SUBS,
    });
    if (!products.some((product) => product.identifier === productId)) {
      throw new Error(
        `App Store did not return product ${productId}. In App Store Connect, confirm this subscription is complete (pricing + localization), in the Buxme subscription group, and available for Sandbox. On the device, sign into Settings → App Store → Sandbox Account. Rebuild TestFlight after enabling the In-App Purchase capability.`,
      );
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("App Store did not return product") ||
        error.message.includes("billing unsupported"))
    ) {
      throw error;
    }
    // If the preflight APIs themselves fail, continue to purchaseProduct —
    // it will surface Capgo's native error.
  }

  const result = await NativePurchases.purchaseProduct({
    productIdentifier: productId,
    productType: PURCHASE_TYPE.SUBS,
    appAccountToken: authenticatedUserId,
  });

  const mapped = mapTransaction(result);
  if (!mapped) {
    throw new Error("Purchase completed but product mapping failed.");
  }

  if (!mapped.signedTransactionInfo && !mapped.transactionId) {
    throw new Error(
      "Purchase completed but StoreKit returned no transaction to verify.",
    );
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
