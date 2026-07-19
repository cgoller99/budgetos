"use client";

import {
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  PageHeader,
  SkeletonGrid,
  StatCard,
} from "@/components/ui";
import { pageContainerWideClassName } from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency, formatMonthlyChange } from "@/lib/finance/format";

export function InvestmentsContent() {
  const { isLoading, investments, snapshot, dashboard } = useFinance();

  if (isLoading) {
    return <SkeletonGrid count={3} />;
  }

  const investmentKpi = dashboard.kpiMetrics.find(
    (metric) => metric.label === "Investments",
  );

  return (
    <div className={pageContainerWideClassName}>
      <PageHeader />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Portfolio value"
          value={
            investmentKpi ? formatCurrency(investmentKpi.value) : formatCurrency(0)
          }
          change={
            investmentKpi
              ? formatMonthlyChange(investmentKpi.monthlyChange)
              : "Connect accounts or add holdings"
          }
          positive={(investmentKpi?.monthlyChange ?? 0) >= 0}
        />
        <StatCard
          label="Monthly contributions"
          value={formatCurrency(snapshot.moneyFlow.investments)}
          change="Planned"
          positive
        />
        <StatCard
          label="Safe To Spend impact"
          value={formatCurrency(snapshot.safeToSpend)}
          change="After all planned outflows"
          positive={snapshot.safeToSpend > 0}
        />
      </div>

      {investments.length === 0 ? (
        <EmptyState
          icon="📈"
          title="No investments yet"
          description="Connect a bank with investment accounts via Plaid, or add holdings manually as Buxme expands portfolio tracking."
          action={
            <a
              href="/settings#connections"
              className="focus-ring inline-flex min-h-11 items-center rounded-xl bg-[#0077ed] px-5 text-sm font-medium text-white"
            >
              Connect investments
            </a>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {investments.map((investment) => (
            <Card key={investment.id}>
              <CardHeader title={investment.name} description={investment.type} />
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Value</span>
                  <span className="tabular-nums text-white">
                    {formatCurrency(investment.value)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Monthly contribution</span>
                  <span className="tabular-nums text-white">
                    {formatCurrency(investment.monthlyContribution)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
