"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui";
import { useNativeIos } from "@/lib/native/useNativeIos";
import { useSubscription } from "@/context/SubscriptionContext";
import { getPlanDisplayName, type SubscriptionPlan } from "@/lib/subscription/types";
import { isStripeClientEnabled } from "@/lib/stripe/clientConfig";

type ProUpgradeBannerProps = {
  requiredPlan: SubscriptionPlan;
  featureLabel: string;
};

export function ProUpgradeBanner({
  requiredPlan,
  featureLabel,
}: ProUpgradeBannerProps) {
  const nativeIos = useNativeIos();
  const { hasMinimumPlan, isFounder, isLoading } = useSubscription();
  const stripeEnabled = isStripeClientEnabled();

  if (isLoading || isFounder || hasMinimumPlan(requiredPlan) || !stripeEnabled) {
    return null;
  }

  if (nativeIos) {
    return (
      <div
        className="rounded-[16px] border border-[var(--accent)]/20 bg-[var(--accent-muted)] px-4 py-3.5"
        data-ios-upgrade-banner="true"
      >
        <p className="text-[15px] font-semibold text-[var(--foreground)]">
          {featureLabel} requires {getPlanDisplayName(requiredPlan)}
        </p>
        <p className="mt-1 text-[13px] text-[var(--text-muted)]">
          Upgrade in Settings to unlock advanced reports and premium features.
        </p>
        <Link
          href={`/settings?upgrade=${requiredPlan}#billing`}
          className="mt-3 flex min-h-11 items-center justify-center rounded-[12px] bg-[var(--accent)] px-4 text-[15px] font-semibold text-white"
        >
          Upgrade to {getPlanDisplayName(requiredPlan)}
        </Link>
      </div>
    );
  }

  return (
    <Card variant="subtle" className="border-[var(--accent)]/20 bg-[var(--accent-muted)]">
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {featureLabel} requires {getPlanDisplayName(requiredPlan)}
          </p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Upgrade in Settings to unlock advanced reports and premium features.
          </p>
        </div>
        <Link
          href={`/settings?upgrade=${requiredPlan}#billing`}
          className="inline-flex min-h-10 items-center justify-center rounded-[var(--radius-button)] bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
        >
          Upgrade to {getPlanDisplayName(requiredPlan)}
        </Link>
      </CardContent>
    </Card>
  );
}
