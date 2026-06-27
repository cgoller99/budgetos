"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useFinance } from "@/context/FinanceContext";

export function HomeRedirect() {
  const router = useRouter();
  const {
    isConfigured,
    isLoading: authLoading,
    isAuthenticated,
    needsEmailVerification,
    user,
  } = useAuth();
  const { isLoading: financeLoading, onboardingComplete } = useFinance();

  useEffect(() => {
    if (authLoading || financeLoading) {
      return;
    }

    if (isConfigured && !isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (needsEmailVerification) {
      const email = user?.email
        ? `?email=${encodeURIComponent(user.email)}`
        : "";
      router.replace(`/verify-email${email}`);
      return;
    }

    router.replace(onboardingComplete ? "/dashboard" : "/onboarding");
  }, [
    authLoading,
    financeLoading,
    isAuthenticated,
    isConfigured,
    needsEmailVerification,
    onboardingComplete,
    router,
    user?.email,
  ]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a]">
      <div className="h-8 w-8 animate-pulse rounded-full bg-[#0077ed]/30" />
    </div>
  );
}
