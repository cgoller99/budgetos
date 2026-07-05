"use client";

import { AuthProvider } from "@/context/AuthContext";
import { FinanceProvider } from "@/context/FinanceContext";
import { HouseholdProvider } from "@/context/HouseholdContext";
import { ToastProvider } from "@/context/ToastContext";
import { AnalyticsProvider } from "@/components/providers/AnalyticsProvider";
import { ThemeInit } from "@/components/providers/ThemeInit";

type AppProvidersProps = {
  children: React.ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ToastProvider>
      <ThemeInit />
      <AuthProvider>
        <AnalyticsProvider>
          <HouseholdProvider>
            <FinanceProvider>{children}</FinanceProvider>
          </HouseholdProvider>
        </AnalyticsProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
