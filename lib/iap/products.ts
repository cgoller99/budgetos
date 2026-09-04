export type IapProductId = "com.buxme.pro.monthly" | "com.buxme.proplus.monthly";

export type IapPlan = "pro" | "pro_plus";

/**
 * App Store Connect product IDs (auto-renewable subscriptions).
 * Must match ASC exactly — do not use the iOS bundle id as a product-id prefix.
 */
export const IAP_PRODUCTS: Record<
  IapPlan,
  {
    productId: IapProductId;
    label: string;
  }
> = {
  pro: {
    productId: "com.buxme.pro.monthly",
    label: "Pro",
  },
  pro_plus: {
    productId: "com.buxme.proplus.monthly",
    label: "Pro+",
  },
};

export const IAP_PRODUCT_IDS: IapProductId[] = [
  IAP_PRODUCTS.pro.productId,
  IAP_PRODUCTS.pro_plus.productId,
];

export function planFromIapProductId(productId: string): IapPlan | null {
  if (productId === IAP_PRODUCTS.pro.productId) {
    return "pro";
  }

  if (productId === IAP_PRODUCTS.pro_plus.productId) {
    return "pro_plus";
  }

  return null;
}

export const APPLE_MANAGE_SUBSCRIPTIONS_URL =
  "https://apps.apple.com/account/subscriptions";
