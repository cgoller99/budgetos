"use client";

import { CategoryBars } from "@/components/charts/CategoryBars";
import { Card, CardContent, CardHeader, PanelLink } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";

export function SpendingBreakdownCard() {
  const { snapshot } = useFinance();
  const items = snapshot.categoryBreakdown.map((item) => ({
    label: item.category,
    amount: item.amount,
    percent: item.percent,
  }));

  return (
    <Card hover variant="subtle">
      <CardHeader
        title="Spending Breakdown"
        action={<PanelLink href="/reports">Reports</PanelLink>}
      />
      <CardContent>
        <CategoryBars items={items} maxItems={5} />
      </CardContent>
    </Card>
  );
}
