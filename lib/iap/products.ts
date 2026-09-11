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
    subscriptionTitle: string;
    durationLabel: string;
    usPriceLabel: string;
  }
> = {
  pro: {
    productId: "com.buxme.pro.monthly",
    label: "Pro",
    subscriptionTitle: "Buxme Pro",
    durationLabel: "1 month",
    usPriceLabel: "$7.99/month",
  },
  pro_plus: {
    productId: "com.buxme.proplus.monthly",
    label: "Pro+",
    subscriptionTitle: "Buxme Pro+",
    durationLabel: "1 month",
    usPriceLabel: "$14.99/month",
  },
};

export const IAP_PRODUCT_IDS: IapProductId[] = [
  IAP_PRODUCTS.pro.productId,
  IAP_PRODUCTS.pro_plus.productId,
];

export const BUXME_PRIVACY_POLICY_URL = "https://buxme.co/privacy";
export const APPLE_STANDARD_EULA_URL =
  "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

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
