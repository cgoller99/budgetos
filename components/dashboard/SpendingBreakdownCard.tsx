"use client";

import { DonutChart } from "@/components/charts/DonutChart";
import { Card, CardContent, CardHeader, PanelLink } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";

export function SpendingBreakdownCard() {
  const { snapshot } = useFinance();
  const segments = snapshot.categoryBreakdown.map((item) => ({
    label: item.category,
    value: item.amount,
    percent: item.percent,
  }));

  return (
    <Card hover variant="subtle">
      <CardHeader
        title="Spending Breakdown"
        action={<PanelLink href="/reports">Reports</PanelLink>}
      />
      <CardContent>
        <DonutChart segments={segments} />
      </CardContent>
    </Card>
  );
}
