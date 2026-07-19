"use client";

import Link from "next/link";
import { EventHistoryList } from "@/components/events/EventHistoryList";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";

export function RecentActivityCard() {
  const { recentActivity } = useFinance();

  return (
    <Card hover>
      <CardHeader
        title="Recent Activity"
        description="Connected updates across your financial command center"
        action={
          <Link
            href="/transactions"
            className="text-xs font-medium text-[var(--accent)] hover:underline"
          >
            View all
          </Link>
        }
      />
      <CardContent>
        <EventHistoryList
          items={recentActivity}
          emptyMessage="Your financial activity feed starts here — add accounts, bills, goals, or transactions."
        />
      </CardContent>
    </Card>
  );
}
