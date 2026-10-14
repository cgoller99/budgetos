"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  identifyAnalyticsUser,
  initAnalytics,
  resetAnalyticsUser,
  trackFirstOpen,
} from "@/lib/analytics/client";
import { getNativePlatform } from "@/lib/native/platform";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (isAuthenticated && user) {
      identifyAnalyticsUser({
        id: user.id,
        email: user.email,
        name: (user.user_metadata?.full_name as string | undefined) ?? null,
      });
    } else {
      resetAnalyticsUser();
    }

    trackFirstOpen(getNativePlatform());
  }, [isAuthenticated, isLoading, user]);

  return children;
}
