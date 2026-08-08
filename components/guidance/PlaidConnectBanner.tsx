"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { cn } from "@/components/ui/cn";
import type { OnboardingProgress } from "@/lib/onboarding/progress";
import { shouldShowPlaidConnectBanner } from "@/lib/onboarding/progress";

const DISMISS_STORAGE_KEY = "buxme-plaid-connect-banner-dismissed";

type PlaidConnectBannerProps = {
  onboardingProgress?: OnboardingProgress;
  className?: string;
};

export function PlaidConnectBanner({
  onboardingProgress = {},
  className,
}: PlaidConnectBannerProps) {
  const { bankConnections, accounts, debts, isLoading } = useFinance();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_STORAGE_KEY) === "1");
  }, []);

  // Prefer active (non-disconnected) links — never infer from transactions.
  const hasPlaidConnection = bankConnections.some(
    (connection) => connection.status !== "disconnected",
  ) ||
    accounts.some((account) => account.isPlaidLinked) ||
    debts.some((debt) => debt.isPlaidLinked);

  const visible =
    !isLoading &&
    shouldShowPlaidConnectBanner({
      dismissed,
      hasPlaidConnection,
      progress: onboardingProgress,
      accountCount: accounts.length,
    });

  const dismiss = useCallback(() => {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, "1");
    setDismissed(true);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-4 py-4 sm:px-5 sm:py-5",
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--foreground)]">
            Connect your bank with Plaid
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Connect your bank with Plaid to automatically import your accounts, balances, and
            transactions.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href="/accounts">
            <Button size="md">Connect Bank</Button>
          </Link>
          <Button variant="ghost" size="md" onClick={dismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}

export function clearPlaidConnectBannerDismissal(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(DISMISS_STORAGE_KEY);
}
