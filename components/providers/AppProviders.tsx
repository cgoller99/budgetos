"use client";

import { AuthProvider } from "@/context/AuthContext";
import { FinanceProvider } from "@/context/FinanceContext";
import { HouseholdProvider } from "@/context/HouseholdContext";
import { ToastProvider } from "@/context/ToastContext";
import { ThemeInit } from "@/components/providers/ThemeInit";

type AppProvidersProps = {
  children: React.ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ToastProvider>
      <ThemeInit />
      <AuthProvider>
        <HouseholdProvider>
          <FinanceProvider>{children}</FinanceProvider>
        </HouseholdProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
