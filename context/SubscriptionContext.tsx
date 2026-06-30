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
  type SubscriptionPlan,
  type UserSubscription,
} from "@/lib/subscription/types";
import { fetchEntitlements } from "@/lib/subscription/clientApi";

type SubscriptionContextValue = {
  subscription: UserSubscription;
  isLoading: boolean;
  isFounder: boolean;
  refreshSubscription: (options?: { refresh?: boolean }) => Promise<void>;
  hasProAccess: boolean;
  hasProPlusAccess: boolean;
  hasMinimumPlan: (plan: SubscriptionPlan) => boolean;
};

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, isConfigured } = useAuth();
  const [subscription, setSubscription] =
    useState<UserSubscription>(FREE_SUBSCRIPTION);
  const [isFounder, setIsFounder] = useState(false);
  const [hasProAccessFlag, setHasProAccessFlag] = useState(false);
  const [hasProPlusAccessFlag, setHasProPlusAccessFlag] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(user && isConfigured));

  const refreshSubscription = useCallback(
    async (options?: { refresh?: boolean }) => {
      if (!user || !isConfigured) {
        setSubscription(FREE_SUBSCRIPTION);
        setIsFounder(false);
        setHasProAccessFlag(false);
        setHasProPlusAccessFlag(false);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const entitlements = await fetchEntitlements(options);
        setSubscription(entitlements.subscription);
        setIsFounder(entitlements.isFounder);
        setHasProAccessFlag(entitlements.hasProAccess);
        setHasProPlusAccessFlag(entitlements.hasProPlusAccess);
      } catch {
        setSubscription(FREE_SUBSCRIPTION);
        setIsFounder(false);
        setHasProAccessFlag(false);
        setHasProPlusAccessFlag(false);
      } finally {
        setIsLoading(false);
      }
    },
    [isConfigured, user],
  );

  useEffect(() => {
    void refreshSubscription();
  }, [refreshSubscription]);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      subscription,
      isLoading,
      isFounder,
      refreshSubscription,
      hasProAccess: hasProAccessFlag,
      hasProPlusAccess: hasProPlusAccessFlag,
      hasMinimumPlan: (plan) => {
        if (isFounder) {
          return true;
        }

        if (plan === "pro_plus") {
          return hasProPlusAccessFlag;
        }

        if (plan === "pro") {
          return hasProAccessFlag;
        }

        return true;
      },
    }),
    [
      hasProAccessFlag,
      hasProPlusAccessFlag,
      isFounder,
      isLoading,
      refreshSubscription,
      subscription,
    ],
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
      isFounder: false,
      refreshSubscription: async () => undefined,
      hasProAccess: true,
      hasProPlusAccess: true,
      hasMinimumPlan: () => true,
    };
  }

  return context;
}
