"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageLoadingState } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoading, onboardingComplete } = useFinance();

  useEffect(() => {
    if (!isLoading && !onboardingComplete) {
      router.replace("/onboarding");
    }
  }, [isLoading, onboardingComplete, router]);

  if (isLoading) {
    return <PageLoadingState label="Loading your finances" />;
  }

  if (!onboardingComplete) {
    return null;
  }

  return children;
}
