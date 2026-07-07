"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PageLoadingState } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading, onboardingComplete } = useFinance();

  if (pathname.startsWith("/oauth/plaid")) {
    return children;
  }

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
