"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IosAvatar,
  IosCard,
  IosHeroMetric,
  IosList,
  IosListRow,
  IosPrimaryButton,
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
          <IosList>
            {portfolio.holdings.map((holding) => (
              <IosListRow
                key={holding.id}
                title={holding.name}
                subtitle={holding.subtitle}
                leading={
                  <IosAvatar
                    fallback={holding.name.slice(0, 1).toUpperCase()}
                    tone="warning"
                  />
                }
                trailing={formatCurrency(holding.value)}
              />
            ))}
          </IosList>
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
