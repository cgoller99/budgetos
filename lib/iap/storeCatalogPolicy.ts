export type StoreCatalogProductLike = {
  productId: string;
  plan: "pro" | "pro_plus";
};

export type StoreCatalogEvaluation = {
  status: "ready" | "partial" | "empty";
  returnedProductIds: string[];
  missingProductIds: string[];
};

export const STORE_CATALOG_RETRY_DELAYS_MS = [0, 800, 2500, 6000] as const;

export function evaluateStoreCatalog(
  products: readonly StoreCatalogProductLike[],
  expectedProductIds: readonly string[],
): StoreCatalogEvaluation {
  const returnedProductIds = [
    ...new Set(products.map((product) => product.productId)),
  ];
  const missingProductIds = expectedProductIds.filter(
    (id) => !returnedProductIds.includes(id),
  );

  return {
    status:
      missingProductIds.length === 0
        ? "ready"
        : returnedProductIds.length === 0
          ? "empty"
          : "partial",
    returnedProductIds,
    missingProductIds,
  };
}

export function indexStoreProductsByPlan<T extends StoreCatalogProductLike>(
  products: readonly T[],
): Partial<Record<StoreCatalogProductLike["plan"], T>> {
  const result: Partial<Record<StoreCatalogProductLike["plan"], T>> = {};
  for (const product of products) {
    result[product.plan] = product;
  }
  return result;
}

export function shouldRetryStoreCatalog(
  status: StoreCatalogEvaluation["status"] | "error",
  attemptIndex: number,
): boolean {
  return status !== "ready" && attemptIndex < STORE_CATALOG_RETRY_DELAYS_MS.length - 1;
}
