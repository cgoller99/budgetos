import "server-only";

import { isFounderEmail } from "@/lib/founder/emails";
import {
  hasMinimumPlan,
  hasProAccess,
  hasProPlusAccess,
  type SubscriptionPlan,
  type UserSubscription,
} from "@/lib/subscription/types";

export type EffectiveEntitlements = {
  isFounder: boolean;
  subscription: UserSubscription;
  hasProAccess: boolean;
  hasProPlusAccess: boolean;
  hasMinimumPlan: (plan: SubscriptionPlan) => boolean;
};

export function getEffectiveEntitlements(input: {
  email: string | null | undefined;
  subscription: UserSubscription;
}): EffectiveEntitlements {
  const isFounder = isFounderEmail(input.email);

  if (isFounder) {
    return {
      isFounder: true,
      subscription: input.subscription,
      hasProAccess: true,
      hasProPlusAccess: true,
      hasMinimumPlan: () => true,
    };
  }

  return {
    isFounder: false,
    subscription: input.subscription,
    hasProAccess: hasProAccess(input.subscription),
    hasProPlusAccess: hasProPlusAccess(input.subscription),
    hasMinimumPlan: (plan) => hasMinimumPlan(input.subscription, plan),
  };
}
