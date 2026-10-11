"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IosAvatar,
  IosCard,
  IosHeroMetric,
  IosPrimaryButton,
  IosProgressBar,
  IosScreen,
  IosSection,
  IosSkeletonScreen,
} from "@/components/native/ios/IosPrimitives";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency, formatMonthlyChange } from "@/lib/finance/format";
import { getPortfolioPresentation } from "@/lib/investments/portfolioPresentation";
import { navigateSettingsDeepLink } from "@/lib/native/navigateSettingsHash";
import { cn } from "@/components/ui/cn";

export function IosInvestmentsScreen() {
  const finance = useFinance();
  const pathname = usePathname();
  const { isLoading, snapshot } = finance;

  if (isLoading) {
    return <IosSkeletonScreen rows={4} />;
  }

  const portfolio = getPortfolioPresentation(finance);

  return (
    <IosScreen>
      <IosHeroMetric
        label="Portfolio value"
        value={formatCurrency(portfolio.portfolioValue)}
        hint={
          portfolio.hasHoldings
            ? formatMonthlyChange(portfolio.monthlyChange)
            : "Connect investment accounts to sync holdings"
        }
        tone={
          !portfolio.hasHoldings
            ? "default"
            : portfolio.monthlyChange >= 0
              ? "positive"
              : "danger"
        }
      />

      {portfolio.hasHoldings ? (
        <div className="grid grid-cols-2 gap-3">
          <IosCard padding="md">
            <p className="text-[12px] font-medium text-[var(--text-muted)]">
              Contributions
            </p>
            <p className="mt-1 text-[18px] font-semibold tabular-nums text-[var(--foreground)]">
              {formatCurrency(snapshot.moneyFlow.investments)}
            </p>
            <p className="mt-1 text-[11px] text-[var(--text-subtle)]">Monthly planned</p>
          </IosCard>
          <IosCard padding="md">
            <p className="text-[12px] font-medium text-[var(--text-muted)]">
              Safe to Spend
            </p>
            <p
              className={cn(
                "mt-1 text-[18px] font-semibold tabular-nums",
                snapshot.safeToSpend >= 0
                  ? "text-[var(--foreground)]"
                  : "text-[var(--danger)]",
              )}
            >
              {formatCurrency(snapshot.safeToSpend)}
            </p>
            <p className="mt-1 text-[11px] text-[var(--text-subtle)]">After outflows</p>
          </IosCard>
        </div>
      ) : null}

      {portfolio.hasHoldings ? (
        <IosSection title="Holdings">
          <div className="flex flex-col gap-3">
            {portfolio.holdings.map((holding) => {
              const share =
                portfolio.portfolioValue > 0
                  ? Math.round((holding.value / portfolio.portfolioValue) * 100)
                  : 0;
              return (
                <div key={holding.id} className="rounded-[16px] bg-[var(--surface)] p-3.5">
                  <div className="flex items-center gap-3">
                    <IosAvatar
                      fallback={holding.name.slice(0, 1).toUpperCase()}
                      tone="accent"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">
                        {holding.name}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-[var(--text-muted)]">
                        {holding.subtitle}
                      </p>
                    </div>
                    <p className="shrink-0 text-[15px] font-semibold tabular-nums text-[var(--foreground)]">
                      {formatCurrency(holding.value)}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <IosProgressBar value={share} className="flex-1" />
                    <span className="text-[12px] font-medium tabular-nums text-[var(--text-muted)]">
                      {share}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex justify-end px-0.5">
            <Link
              href="/settings#connections"
              className="min-h-11 text-[13px] font-semibold text-[var(--accent-light)]"
              onClick={(event) => {
                if (navigateSettingsDeepLink("/settings#connections", pathname)) {
                  event.preventDefault();
                }
              }}
            >
              Manage connections
            </Link>
          </div>
        </IosSection>
      ) : (
        <IosSection title="Holdings">
          <IosCard padding="md">
            <p className="text-[15px] font-semibold text-[var(--foreground)]">
              No investments connected
            </p>
            <p className="mt-1 text-[13px] leading-snug text-[var(--text-muted)]">
              Link a brokerage account to track portfolio value and holdings here.
            </p>
            <div className="mt-4">
              <Link
                href="/settings#connections"
                onClick={(event) => {
                  if (navigateSettingsDeepLink("/settings#connections", pathname)) {
                    event.preventDefault();
                  }
                }}
              >
                <IosPrimaryButton>Connect investments</IosPrimaryButton>
              </Link>
            </div>
          </IosCard>
        </IosSection>
      )}
    </IosScreen>
  );
}
