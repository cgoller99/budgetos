"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";
import {
  FREE_SUBSCRIPTION,
  hasMinimumPlan,
  hasProAccess,
  hasProPlusAccess,
  type SubscriptionPlan,
  type UserSubscription,
} from "@/lib/subscription/types";
import { fetchUserSubscription } from "@/lib/stripe/clientApi";
import { isStripeClientEnabled } from "@/lib/stripe/clientConfig";

type SubscriptionContextValue = {
  subscription: UserSubscription;
  isLoading: boolean;
  isStripeEnabled: boolean;
  refreshSubscription: (options?: { refresh?: boolean }) => Promise<void>;
  hasProAccess: boolean;
  hasProPlusAccess: boolean;
  hasMinimumPlan: (plan: SubscriptionPlan) => boolean;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, isConfigured } = useAuth();
  const stripeEnabled = isStripeClientEnabled();
  const [subscription, setSubscription] =
    useState<UserSubscription>(FREE_SUBSCRIPTION);
  const [isLoading, setIsLoading] = useState(stripeEnabled);

  const refreshSubscription = useCallback(
    async (options?: { refresh?: boolean }) => {
      if (!stripeEnabled || !user || !isConfigured) {
        setSubscription(FREE_SUBSCRIPTION);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const next = await fetchUserSubscription(options);
        setSubscription(next);
      } catch {
        setSubscription(FREE_SUBSCRIPTION);
      } finally {
        setIsLoading(false);
      }
    },
    [isConfigured, stripeEnabled, user],
  );

  useEffect(() => {
    void refreshSubscription();
  }, [refreshSubscription]);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      subscription,
      isLoading,
      isStripeEnabled: stripeEnabled,
      refreshSubscription,
      hasProAccess: hasProAccess(subscription),
      hasProPlusAccess: hasProPlusAccess(subscription),
      hasMinimumPlan: (plan) => hasMinimumPlan(subscription, plan),
    }),
    [isLoading, refreshSubscription, stripeEnabled, subscription],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);

  if (!context) {
    return {
      subscription: FREE_SUBSCRIPTION,
      isLoading: false,
      isStripeEnabled: false,
      refreshSubscription: async () => undefined,
      hasProAccess: true,
      hasProPlusAccess: true,
      hasMinimumPlan: () => true,
    };
  }

  return context;
}
