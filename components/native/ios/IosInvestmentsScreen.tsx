"use client";

import Link from "next/link";
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
import { cn } from "@/components/ui/cn";

export function IosInvestmentsScreen() {
  const { isLoading, investments, snapshot, dashboard } = useFinance();

  if (isLoading) {
    return <IosSkeletonScreen rows={4} />;
  }

  const investmentKpi = dashboard.kpiMetrics.find(
    (metric) => metric.label === "Investments",
  );

  return (
    <IosScreen>
      <IosHeroMetric
        label="Portfolio value"
        value={
          investmentKpi ? formatCurrency(investmentKpi.value) : formatCurrency(0)
        }
        hint={
          investmentKpi
            ? formatMonthlyChange(investmentKpi.monthlyChange)
            : "Connect investment accounts to sync holdings"
        }
        tone={(investmentKpi?.monthlyChange ?? 0) >= 0 ? "positive" : "danger"}
      />

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

      {investments.length === 0 ? (
        <IosSection title="Holdings">
          <IosList>
            <IosListRow
              title="No investments yet"
              subtitle="Link brokerage accounts via Plaid"
              leading={<IosAvatar fallback="📈" tone="warning" />}
              href="/settings#connections"
              trailing={<span className="text-[var(--accent-light)]">›</span>}
            />
          </IosList>
          <div className="mt-3">
            <Link href="/settings#connections">
              <IosPrimaryButton>Connect investments</IosPrimaryButton>
            </Link>
          </div>
        </IosSection>
      ) : (
        <IosSection title="Holdings">
          <IosList>
            {investments.map((investment) => (
              <IosListRow
                key={investment.id}
                title={investment.name}
                subtitle={`${investment.type} · ${formatCurrency(investment.monthlyContribution)}/mo`}
                leading={
                  <IosAvatar
                    fallback={investment.name.slice(0, 1).toUpperCase()}
                    tone="warning"
                  />
                }
                trailing={formatCurrency(investment.value)}
              />
            ))}
          </IosList>
          <div className="mt-3 flex justify-end px-0.5">
            <Link
              href="/settings#connections"
              className="min-h-11 text-[13px] font-semibold text-[var(--accent-light)]"
            >
              Manage connections
            </Link>
          </div>
        </IosSection>
      )}
    </IosScreen>
  );
}
