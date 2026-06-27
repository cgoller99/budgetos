"use client";

import { AuthProvider } from "@/context/AuthContext";
import { FinanceProvider } from "@/context/FinanceContext";
import { ToastProvider } from "@/context/ToastContext";

type AppProvidersProps = {
  children: React.ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ToastProvider>
      <AuthProvider>
        <FinanceProvider>{children}</FinanceProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
