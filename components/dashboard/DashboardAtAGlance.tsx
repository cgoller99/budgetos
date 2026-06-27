"use client";

import Link from "next/link";
import { useMemo } from "react";
import { EventHistoryList } from "@/components/events/EventHistoryList";
import { DebtOverviewCard } from "@/components/dashboard/DebtOverviewCard";
import { UpcomingBillsCard } from "@/components/dashboard/UpcomingBillsCard";
import { NextMilestoneCard } from "@/components/roadmap/NextMilestoneCard";
import { Card } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";

export function DashboardAtAGlance() {
  const { recentActivity } = useFinance();

  return (
    <Card padding="lg">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-12 xl:grid-cols-3">
        <div>
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold tracking-tight text-white">
              Next milestone
            </h2>
            <Link
              href="/roadmap"
              className="text-sm text-white/40 transition-colors hover:text-white/70"
            >
              Roadmap
            </Link>
          </div>
          <NextMilestoneCard embedded />
        </div>

        <div className="lg:border-l lg:border-white/[0.04] lg:pl-12 xl:pl-12">
          <DebtOverviewCard embedded />
        </div>

        <div className="lg:col-span-2 xl:col-span-1 xl:border-l xl:border-white/[0.04] xl:pl-12">
          <UpcomingBillsCard embedded />
        </div>

        <div className="lg:col-span-2 xl:col-span-3 xl:border-t xl:border-white/[0.04] xl:pt-10">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold tracking-tight text-white">
              Recent activity
            </h2>
            <Link
              href="/reports"
              className="text-sm text-white/40 transition-colors hover:text-white/70"
            >
              Reports
            </Link>
          </div>
          <EventHistoryList
            items={recentActivity.slice(0, 4)}
            emptyMessage="Activity appears here as you manage your finances."
          />
        </div>
      </div>
    </Card>
  );
}
