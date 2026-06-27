"use client";

import { BillsOverviewCard } from "@/components/dashboard/BillsOverviewCard";
import { NetWorthTimeline } from "@/components/dashboard/NetWorthTimeline";
import { EventHistoryList } from "@/components/events/EventHistoryList";
import { HealthScoreCard } from "@/components/HealthScoreCard";
import { SmartInsights } from "@/components/SmartInsights";
import { Card, CardContent, CardHeader, SkeletonGrid } from "@/components/ui";
import { pageContainerWideClassName } from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";
import { getReportEvents } from "@/lib/events";
import { cn } from "@/components/ui/cn";

export function ReportsContent() {
  const finance = useFinance();

  if (finance.isLoading) {
    return <SkeletonGrid count={3} />;
  }

  const reportEvents = getReportEvents(finance);

  return (
    <div className={cn(pageContainerWideClassName)}>
      <NetWorthTimeline />

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
