"use client";

import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { NativePurchases, PURCHASE_TYPE } from "@capgo/native-purchases";
import { isNativeIos } from "@/lib/native/platform";
import { IAP_PRODUCT_IDS, type IapProductId } from "@/lib/iap/products";

/**
 * Secret-safe StoreKit / Capgo probe for TestFlight empty-catalog failures.
 *
 * Call path (Build 9+):
 *   BillingSection → getNativeStoreProducts / purchaseNativePlan
 *   → NativePurchases.getProducts / purchaseProduct (@capgo/native-purchases)
 *   → NativePurchasesPlugin.swift → Product.products(for:)
 *
 * Capgo rejects purchase with "Cannot find product for id …" only after
 * Product.products(for:) returns an empty array for that identifier.
 * An empty catalog here is therefore StoreKit's response, not a JS mapping bug.
 */
export type StoreKitCatalogProbe = {
  probedAt: string;
  platform: string;
  isNativeIos: boolean;
  capacitorNative: boolean;
  /** From @capacitor/app — iOS bundle id when native. */
  appId: string | null;
  appName: string | null;
  appVersion: string | null;
  appBuild: string | null;
  pluginVersion: string | null;
  billingSupported: boolean | null;
  /** From StoreKit AppTransaction (iOS 16+) — no JWS included. */
  storeKitBundleId: string | null;
  storeKitEnvironment: string | null;
  storeKitAppVersion: string | null;
  requestedProductIds: IapProductId[];
  returnedProductIds: string[];
  returnedCount: number;
  missingProductIds: string[];
  /** Per-id lookup via Capgo getProduct (surfaces Capgo reject text). */
  perProduct: Array<{
    productId: IapProductId;
    found: boolean;
    title: string | null;
    priceString: string | null;
    error: string | null;
  }>;
  getProductsError: string | null;
  appInfoError: string | null;
  appTransactionError: string | null;
  /**
   * Evidence-backed verdict for the Billing UI.
   * Does not claim App Store Connect root cause without device proof.
   */
  verdict: string;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  return "Unknown StoreKit/Capgo error";
}

function buildVerdict(probe: Omit<StoreKitCatalogProbe, "verdict">): string {
  if (!probe.isNativeIos) {
    return "Not running inside the native iOS shell — StoreKit is not used.";
  }

  if (probe.getProductsError) {
    return `StoreKit/Capgo getProducts rejected: ${probe.getProductsError}`;
  }

  if (probe.billingSupported === false) {
    return "Capgo reports billing unsupported on this device (iOS < 15).";
  }

  if (
    probe.storeKitBundleId &&
    probe.appId &&
    probe.storeKitBundleId !== probe.appId
  ) {
    return `Bundle mismatch: Capacitor appId=${probe.appId} vs StoreKit AppTransaction bundleId=${probe.storeKitBundleId}.`;
  }

  if (probe.returnedCount === 0 && probe.missingProductIds.length > 0) {
    const env = probe.storeKitEnvironment
      ? ` StoreKit environment=${probe.storeKitEnvironment}.`
      : "";
    const bundle = probe.storeKitBundleId || probe.appId;
    return (
      `Product.products(for:) returned 0 of ${probe.requestedProductIds.length} requested IDs` +
      (bundle ? ` for bundle ${bundle}` : "") +
      `. Capgo purchaseProduct fails with "Cannot find product for id …" for the same reason.` +
      env +
      " Next checks outside app code: ASC product completeness (price + localization; Ready to Submit)," +
      " In-App Purchase enabled on App ID / provisioning for this binary," +
      " Sandbox Apple ID signed in on device (Settings → Developer / App Store)."
    );
  }

  if (probe.missingProductIds.length > 0) {
    return `Partial catalog: missing ${probe.missingProductIds.join(", ")}.`;
  }

  return `StoreKit returned all ${probe.returnedCount} requested product(s).`;
}

/**
 * Probes the live Capgo → StoreKit product catalog without purchasing.
 * Never returns JWS, tokens, or account secrets.
 */
export async function probeNativeStoreKitCatalog(): Promise<StoreKitCatalogProbe> {
  const requestedProductIds = [...IAP_PRODUCT_IDS];
  const base = {
    probedAt: new Date().toISOString(),
    platform: Capacitor.getPlatform(),
    isNativeIos: isNativeIos(),
    capacitorNative: Capacitor.isNativePlatform(),
    appId: null as string | null,
    appName: null as string | null,
    appVersion: null as string | null,
    appBuild: null as string | null,
    pluginVersion: null as string | null,
    billingSupported: null as boolean | null,
    storeKitBundleId: null as string | null,
    storeKitEnvironment: null as string | null,
    storeKitAppVersion: null as string | null,
    requestedProductIds,
    returnedProductIds: [] as string[],
    returnedCount: 0,
    missingProductIds: [...requestedProductIds] as string[],
    perProduct: [] as StoreKitCatalogProbe["perProduct"],
    getProductsError: null as string | null,
    appInfoError: null as string | null,
    appTransactionError: null as string | null,
  };

  if (!isNativeIos()) {
    return { ...base, verdict: buildVerdict(base) };
  }

  try {
    const info = await CapApp.getInfo();
    base.appId = info.id || null;
    base.appName = info.name || null;
    base.appVersion = info.version || null;
    base.appBuild = info.build || null;
  } catch (error) {
    base.appInfoError = errorMessage(error);
  }

  try {
    const { version } = await NativePurchases.getPluginVersion();
    base.pluginVersion = version || null;
  } catch {
    // Older binaries may omit this method.
  }

  try {
    const billing = await NativePurchases.isBillingSupported();
    base.billingSupported = Boolean(billing.isBillingSupported);
  } catch (error) {
    base.getProductsError = `isBillingSupported failed: ${errorMessage(error)}`;
  }

  try {
    const { appTransaction } = await NativePurchases.getAppTransaction();
    base.storeKitBundleId = appTransaction.bundleId || null;
    base.storeKitEnvironment = appTransaction.environment || null;
    base.storeKitAppVersion = appTransaction.appVersion || null;
    // Intentionally omit jwsRepresentation — not needed for catalog diagnosis.
  } catch (error) {
    base.appTransactionError = errorMessage(error);
  }

  try {
    const { products } = await NativePurchases.getProducts({
      productIdentifiers: requestedProductIds,
      productType: PURCHASE_TYPE.SUBS,
    });
    base.returnedProductIds = products.map((product) => product.identifier);
    base.returnedCount = base.returnedProductIds.length;
    base.missingProductIds = requestedProductIds.filter(
      (id) => !base.returnedProductIds.includes(id),
    );
  } catch (error) {
    base.getProductsError = errorMessage(error);
  }

  for (const productId of requestedProductIds) {
    try {
      const { product } = await NativePurchases.getProduct({
        productIdentifier: productId,
        productType: PURCHASE_TYPE.SUBS,
      });
      base.perProduct.push({
        productId,
        found: Boolean(product?.identifier),
        title: product?.title ?? null,
        priceString: product?.priceString ?? null,
        error: null,
      });
    } catch (error) {
      base.perProduct.push({
        productId,
        found: false,
        title: null,
        priceString: null,
        error: errorMessage(error),
      });
    }
  }

  return { ...base, verdict: buildVerdict(base) };
}

/** Compact multi-line summary for Billing UI / toast (no secrets). */
export function formatStoreKitCatalogProbe(
  probe: StoreKitCatalogProbe,
): string {
  const lines = [
    probe.verdict,
    `requested=${probe.requestedProductIds.join(",")}`,
    `returned(${probe.returnedCount})=${probe.returnedProductIds.join(",") || "∅"}`,
    `missing=${probe.missingProductIds.join(",") || "∅"}`,
    `appId=${probe.appId ?? "n/a"} build=${probe.appBuild ?? "n/a"}`,
    `storeKitBundle=${probe.storeKitBundleId ?? "n/a"} env=${probe.storeKitEnvironment ?? "n/a"}`,
    `billingSupported=${probe.billingSupported ?? "n/a"} plugin=${probe.pluginVersion ?? "n/a"}`,
  ];

  if (probe.getProductsError) {
    lines.push(`getProductsError=${probe.getProductsError}`);
  }
  if (probe.appTransactionError) {
    lines.push(`appTransactionError=${probe.appTransactionError}`);
  }

  for (const row of probe.perProduct) {
    if (row.error) {
      lines.push(`${row.productId}: ${row.error}`);
    } else if (row.found) {
      lines.push(`${row.productId}: ok ${row.priceString ?? ""}`.trim());
    }
  }

  return lines.join("\n");
}
