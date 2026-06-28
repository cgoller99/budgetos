"use client";

import { useMemo } from "react";
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
  ProgressBar,
  SkeletonGrid,
} from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { pageContainerWideClassName } from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";
import { getReportEvents } from "@/lib/events";
import { formatCurrency } from "@/lib/finance/format";
import {
  computeCategoryBreakdown,
  computeMonthlyTrends,
  computeTotalGoalSavings,
  downloadTransactionsCsv,
  getTrendMaxValue,
  type MonthlyTrendPoint,
} from "@/lib/reports/reportMetrics";

type TrendChartProps = {
  points: MonthlyTrendPoint[];
  valueKey: keyof Pick<MonthlyTrendPoint, "spending" | "income" | "savings">;
  color: string;
  emptyMessage: string;
};

function TrendChart({ points, valueKey, color, emptyMessage }: TrendChartProps) {
  const maxValue = getTrendMaxValue(points);
  const hasData = points.some((point) => point[valueKey] > 0);

  if (!hasData) {
    return (
      <p className="py-6 text-center text-sm text-white/35">{emptyMessage}</p>
    );
  }

  return (
    <div className="flex items-end justify-between gap-2 pt-2">
      {points.map((point) => {
        const value = point[valueKey];
        const heightPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;

        return (
          <div
            key={point.key}
            className="flex min-w-0 flex-1 flex-col items-center gap-2"
          >
            <span className="text-[11px] tabular-nums text-white/40">
              {value > 0 ? formatCurrency(value) : "—"}
            </span>
            <div className="flex h-28 w-full items-end justify-center">
              <div
                className="w-full max-w-10 rounded-t-xl transition-all duration-500 ease-out"
                style={{
                  height: `${Math.max(heightPercent, value > 0 ? 8 : 0)}%`,
                  backgroundColor: color,
                  opacity: value > 0 ? 1 : 0.15,
                }}
              />
            </div>
            <span className="text-[11px] text-white/35">{point.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ReportsContent() {
  const finance = useFinance();

  const monthlyTrends = useMemo(
    () => computeMonthlyTrends(finance),
    [finance.transactions],
  );
  const categoryBreakdown = useMemo(
    () => computeCategoryBreakdown(finance),
    [finance.transactions],
  );
  const totalGoalSavings = useMemo(
    () => computeTotalGoalSavings(finance),
    [finance.savingsGoals],
  );

  if (finance.isLoading) {
    return <SkeletonGrid count={3} />;
  }

  const reportEvents = getReportEvents(finance);

  function handleExportCsv() {
    downloadTransactionsCsv(finance);
  }

  return (
    <div className={cn(pageContainerWideClassName)}>
      <NetWorthTimeline />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card padding="lg">
          <CardHeader title="Monthly spending" />
          <CardContent>
            <TrendChart
              points={monthlyTrends}
              valueKey="spending"
              color="#f87171"
              emptyMessage="Expense transactions will appear here."
            />
          </CardContent>
        </Card>

        <Card padding="lg">
          <CardHeader title="Monthly income" />
          <CardContent>
            <TrendChart
              points={monthlyTrends}
              valueKey="income"
              color="#34d399"
              emptyMessage="Income transactions will appear here."
            />
          </CardContent>
        </Card>

        <Card padding="lg">
          <CardHeader
            title="Savings trend"
            description={`${formatCurrency(totalGoalSavings)} saved across goals`}
          />
          <CardContent>
            <TrendChart
              points={monthlyTrends}
              valueKey="savings"
              color="#0077ed"
              emptyMessage="Goal contributions will appear here."
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card padding="lg">
          <CardHeader
            title="Category breakdown"
            description="Expenses by category"
          />
          <CardContent>
            {categoryBreakdown.length === 0 ? (
              <p className="py-6 text-center text-sm text-white/35">
                Add expense transactions to see category breakdown.
              </p>
            ) : (
              <ul className="space-y-5">
                {categoryBreakdown.map((item) => (
                  <li key={item.category}>
                    <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                      <span className="font-medium text-white/80">
                        {item.category}
                      </span>
                      <span className="tabular-nums text-white/45">
                        {formatCurrency(item.amount)} · {item.percent.toFixed(0)}%
                      </span>
                    </div>
                    <ProgressBar value={item.percent} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card padding="lg">
          <CardHeader
            title="Export transactions"
            description="Download all transactions as CSV"
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExportCsv}
                disabled={finance.transactions.length === 0}
              >
                Export CSV
              </Button>
            }
          />
          <CardContent>
            <p className="text-sm leading-relaxed text-white/40">
              {finance.transactions.length === 0
                ? "Record transactions to enable export."
                : `${finance.transactions.length} transaction${finance.transactions.length === 1 ? "" : "s"} ready to export with date, type, category, amount, account, and notes.`}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <HealthScoreCard />
        <BillsOverviewCard />
      </div>

      <SmartInsights />

      <Card padding="lg">
        <CardHeader title="Activity log" />
        <CardContent>
          <EventHistoryList
            items={reportEvents}
            emptyMessage="Activity from accounts, bills, goals, and transactions will appear here."
          />
        </CardContent>
      </Card>
    </div>
  );
}
