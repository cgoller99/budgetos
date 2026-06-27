"use client";

import Link from "next/link";
import { DashboardAtAGlance } from "@/components/dashboard/DashboardAtAGlance";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { ThisWeeksPlanCard } from "@/components/dashboard/ThisWeeksPlanCard";
import { TodaysActivityCard } from "@/components/dashboard/TodaysActivityCard";
import { MoneyFlowCard } from "@/components/MoneyFlowCard";
import { PaycheckSplitPanel } from "@/components/paycheck/PaycheckSplitPanel";
import { Button, SkeletonGrid } from "@/components/ui";
import { pageContainerWideClassName } from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";
import { cn } from "@/components/ui/cn";

export function DashboardContent() {
  const { isLoading } = useFinance();

  if (isLoading) {
    return <SkeletonGrid count={3} className="max-w-6xl" />;
  }

  return (
    <div className={cn(pageContainerWideClassName)}>
      <DashboardHero />

      <TodaysActivityCard />

      <MoneyFlowCard />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-white/45">Upcoming bills</p>
          <h3 className="text-xl font-semibold tracking-tight text-white">
            Paycheck split & calendar
          </h3>
        </div>
        <Link href="/calendar">
          <Button variant="secondary">Open calendar</Button>
        </Link>
      </div>

      <PaycheckSplitPanel compact />

      <DashboardAtAGlance />

      <ThisWeeksPlanCard />
    </div>
  );
}
