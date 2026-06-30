export type SubscriptionPlan = "free" | "pro" | "pro_plus";

export type SubscriptionStatus =
  | "none"
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete";

export type PaidSubscriptionPlan = Exclude<SubscriptionPlan, "free">;

export type UserSubscription = {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
};

export const FREE_SUBSCRIPTION: UserSubscription = {
  plan: "free",
  status: "none",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  stripePriceId: null,
};

const PLAN_RANK: Record<SubscriptionPlan, number> = {
  free: 0,
  pro: 1,
  pro_plus: 2,
};

export function isPaidPlan(plan: SubscriptionPlan): plan is PaidSubscriptionPlan {
  return plan === "pro" || plan === "pro_plus";
}

export function hasActiveSubscription(subscription: UserSubscription): boolean {
  return (
    subscription.status === "active" ||
    subscription.status === "trialing" ||
    subscription.status === "past_due"
  );
}

export function hasMinimumPlan(
  subscription: UserSubscription,
  minimumPlan: SubscriptionPlan,
): boolean {
  if (!hasActiveSubscription(subscription) && minimumPlan !== "free") {
    return false;
  }

  return PLAN_RANK[subscription.plan] >= PLAN_RANK[minimumPlan];
}

export function hasProAccess(subscription: UserSubscription): boolean {
  return hasMinimumPlan(subscription, "pro");
}

export function hasProPlusAccess(subscription: UserSubscription): boolean {
  return hasMinimumPlan(subscription, "pro_plus");
}

export function parsePaidPlan(value: string | undefined): PaidSubscriptionPlan | null {
  if (value === "pro" || value === "pro_plus") {
    return value;
  }

  return null;
}

export function getPlanDisplayName(plan: SubscriptionPlan): string {
  switch (plan) {
    case "pro_plus":
      return "Pro+";
    case "pro":
      return "Pro";
    default:
      return "Free";
  }
}

export function getStatusDisplayLabel(subscription: UserSubscription): string {
  if (subscription.cancelAtPeriodEnd && hasActiveSubscription(subscription)) {
    return "Canceling";
  }

  if (hasActiveSubscription(subscription)) {
    return subscription.status === "trialing" ? "Trial" : "Active";
  }

  if (subscription.status === "past_due") {
    return "Past due";
  }

  if (subscription.status === "canceled") {
    return "Canceled";
  }

  return "Free";
}
