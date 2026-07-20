"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useFinance } from "@/context/FinanceContext";
import { PageLoadingState } from "@/components/ui";
import { LandingPage } from "./LandingPage";

function HomeLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
      <PageLoadingState label="Loading Buxme" />
    </div>
  );
}

export function HomeGate() {
  const router = useRouter();
  const {
    isLoading: authLoading,
    isAuthenticated,
    needsEmailVerification,
    user,
  } = useAuth();
  const { isLoading: financeLoading, onboardingComplete } = useFinance();

  useEffect(() => {
    if (authLoading || financeLoading || !isAuthenticated) {
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
    needsEmailVerification,
    onboardingComplete,
    router,
    user?.email,
  ]);

  if (authLoading || financeLoading) {
    return <HomeLoading />;
  }

  if (isAuthenticated) {
    return <HomeLoading />;
  }

  return <LandingPage />;
}
