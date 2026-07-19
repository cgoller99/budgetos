"use client";

import { useMemo } from "react";
import { BarTrendChart } from "@/components/charts/BarTrendChart";
import { CategoryBars } from "@/components/charts/CategoryBars";
import { CHART_COLORS } from "@/components/charts/constants";
import { BillsOverviewCard } from "@/components/dashboard/BillsOverviewCard";
import { NetWorthTimeline } from "@/components/dashboard/NetWorthTimeline";
import { EventHistoryList } from "@/components/events/EventHistoryList";
import { HealthScoreCard } from "@/components/HealthScoreCard";
import { SmartInsights } from "@/components/SmartInsights";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  SkeletonGrid,
} from "@/components/ui";
import { MobileCollapsibleSection } from "@/components/ui/MobileCollapsibleSection";
import { cn } from "@/components/ui/cn";
import { pageContainerWideClassName } from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";
import { getReportEvents } from "@/lib/events";
import { formatCurrency } from "@/lib/finance/format";
import {
  computeTotalGoalSavings,
  downloadTransactionsCsv,
  type CategoryBreakdownItem,
  type MonthlyTrendPoint,
} from "@/lib/reports/reportMetrics";

function MonthlyTrendsSection({
  monthlyTrends,
  totalGoalSavings,
}: {
  monthlyTrends: MonthlyTrendPoint[];
  totalGoalSavings: number;
}) {
  const spendingPoints = monthlyTrends.map((point) => ({
    key: point.key,
    label: point.label,
    value: point.spending,
  }));
  const incomePoints = monthlyTrends.map((point) => ({
    key: point.key,
    label: point.label,
    value: point.income,
  }));
  const savingsPoints = monthlyTrends.map((point) => ({
    key: point.key,
    label: point.label,
    value: point.savings,
  }));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <Card variant="subtle">
        <CardHeader title="Monthly spending" />
        <CardContent>
          <BarTrendChart
            points={spendingPoints}
            color={CHART_COLORS.spending}
            emptyMessage="Expense transactions will appear here."
          />
        </CardContent>
      </Card>

      <Card variant="subtle">
        <CardHeader title="Monthly income" />
        <CardContent>
          <BarTrendChart
            points={incomePoints}
            color={CHART_COLORS.income}
            emptyMessage="Income transactions will appear here."
          />
        </CardContent>
      </Card>

      <Card variant="subtle">
        <CardHeader
          title="Savings trend"
          description={totalGoalSavings > 0 ? formatCurrency(totalGoalSavings) : undefined}
        />
        <CardContent>
          <BarTrendChart
            points={savingsPoints}
            color={CHART_COLORS.savings}
            emptyMessage="Goal contributions will appear here."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function CategoryAndExportSection({
  categoryBreakdown,
  transactionCount,
  onExportCsv,
}: {
  categoryBreakdown: CategoryBreakdownItem[];
  transactionCount: number;
  onExportCsv: () => void;
}) {
  const items = categoryBreakdown.map((item) => ({
    label: item.category,
    amount: item.amount,
    percent: item.percent,
  }));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card variant="subtle">
        <CardHeader title="Category breakdown" />
        <CardContent>
          <CategoryBars items={items} />
        </CardContent>
      </Card>

      <Card variant="subtle">
        <CardHeader
          title="Export transactions"
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={onExportCsv}
              disabled={transactionCount === 0}
            >
              Export CSV
            </Button>
          }
        />
        <CardContent>
          <p className="text-sm text-[var(--text-muted)]">
            {transactionCount === 0
              ? "Record transactions to enable export."
              : `${transactionCount} ready to export.`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportsSecondarySection({
  reportEvents,
}: {
  reportEvents: ReturnType<typeof getReportEvents>;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <HealthScoreCard />
        <BillsOverviewCard />
      </div>

      <SmartInsights />

      <Card variant="subtle">
        <CardHeader title="Activity log" />
        <CardContent>
          <EventHistoryList
            items={reportEvents}
            emptyMessage="Activity will appear here."
          />
        </CardContent>
      </Card>
    </>
  );
}

export function ReportsContent() {
  const finance = useFinance();
  const { snapshot, isLoading } = finance;

  const monthlyTrends = snapshot.monthlyTrends;
  const categoryBreakdown = snapshot.categoryBreakdown;
  const totalGoalSavings = useMemo(
    () => computeTotalGoalSavings(finance),
    [finance.savingsGoals],
  );

  if (isLoading) {
    return <SkeletonGrid count={3} />;
  }

  const reportEvents = getReportEvents(finance);

  function handleExportCsv() {
    downloadTransactionsCsv(finance);
  }

  return (
    <div className={cn(pageContainerWideClassName, "space-y-5")}>
      <NetWorthTimeline />

      {/* Mobile: trends first, details behind View more */}
      <div className="space-y-4 lg:hidden">
        <MonthlyTrendsSection
          monthlyTrends={monthlyTrends}
          totalGoalSavings={totalGoalSavings}
        />

        <MobileCollapsibleSection
          title="Categories & export"
          description="Breakdown by category and CSV download"
        >
          <CategoryAndExportSection
            categoryBreakdown={categoryBreakdown}
            transactionCount={finance.transactions.length}
            onExportCsv={handleExportCsv}
          />
        </MobileCollapsibleSection>

        <MobileCollapsibleSection
          title="Health, bills & insights"
          description="Score, bill overview, and smart recommendations"
        >
          <div className="space-y-4">
            <ReportsSecondarySection reportEvents={reportEvents} />
          </div>
        </MobileCollapsibleSection>
      </div>

      {/* Desktop: full reports */}
      <div className="hidden space-y-5 lg:block">
        <MonthlyTrendsSection
          monthlyTrends={monthlyTrends}
          totalGoalSavings={totalGoalSavings}
        />

        <CategoryAndExportSection
          categoryBreakdown={categoryBreakdown}
          transactionCount={finance.transactions.length}
          onExportCsv={handleExportCsv}
        />

        <ReportsSecondarySection reportEvents={reportEvents} />
      </div>
    </div>
  );
}
