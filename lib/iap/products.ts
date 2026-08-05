export type IapProductId = "co.buxme.app.pro.monthly" | "co.buxme.app.proplus.monthly";

export type IapPlan = "pro" | "pro_plus";

export const IAP_PRODUCTS: Record<
  IapPlan,
  {
    productId: IapProductId;
    label: string;
  }
> = {
  pro: {
    productId: "co.buxme.app.pro.monthly",
    label: "Pro",
  },
  pro_plus: {
    productId: "co.buxme.app.proplus.monthly",
    label: "Pro+",
  },
};

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
