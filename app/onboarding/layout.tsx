"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/auth/AuthGate";
import { useFinance } from "@/context/FinanceContext";

export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const { isLoading, onboardingComplete } = useFinance();

  useEffect(() => {
    if (!isLoading && onboardingComplete) {
      router.replace("/dashboard");
    }
  }, [isLoading, onboardingComplete, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0f1a]">
        <div className="h-8 w-8 animate-pulse rounded-full bg-[#0077ed]/30" />
      </div>
    );
  }

  if (onboardingComplete) {
    return null;
  }

  return <AuthGate>{children}</AuthGate>;
}
