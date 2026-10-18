"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PageLoadingState } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoading, onboardingComplete, onboardingHydrated } = useFinance();
  const skipGate = pathname.startsWith("/oauth/plaid");

  useEffect(() => {
    if (skipGate) {
      return;
    }

    // Wait until onboarding flags are loaded — never redirect during the
    // intentional reset of onboardingComplete while finance cache warms.
    if (!isLoading && onboardingHydrated && !onboardingComplete) {
      router.replace("/onboarding");
    }
  }, [isLoading, onboardingComplete, onboardingHydrated, router, skipGate]);

  if (skipGate) {
    return children;
  }

  if (isLoading || !onboardingHydrated) {
    return <PageLoadingState label="Loading your finances" />;
  }

  if (!onboardingComplete) {
    return <PageLoadingState label="Loading your finances" />;
  }

  return children;
}
