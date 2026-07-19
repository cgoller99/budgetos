"use client";

import { useMemo } from "react";
import { BarTrendChart } from "@/components/charts/BarTrendChart";
import { CHART_COLORS } from "@/components/charts/constants";
import { Card, CardContent, CardHeader, PanelLink } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";

export function FinancialTrendsCard() {
  const { snapshot } = useFinance();

  const spendingPoints = useMemo(
    () =>
      snapshot.monthlyTrends.map((point) => ({
        key: point.key,
        label: point.label,
        value: point.spending,
      })),
    [snapshot.monthlyTrends],
  );

  return (
    <Card hover variant="subtle" className="lg:col-span-2">
      <CardHeader
        title="Financial Trends"
        action={<PanelLink href="/reports">Reports</PanelLink>}
      />
      <CardContent>
        <BarTrendChart
          points={spendingPoints}
          color={CHART_COLORS.spending}
          emptyMessage="Spending trends appear as you add transactions."
        />
      </CardContent>
    </Card>
  );
}
