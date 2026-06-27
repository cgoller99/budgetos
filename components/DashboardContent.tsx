"use client";

import { DashboardAtAGlance } from "@/components/dashboard/DashboardAtAGlance";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { ThisWeeksPlanCard } from "@/components/dashboard/ThisWeeksPlanCard";
import { TodaysActivityCard } from "@/components/dashboard/TodaysActivityCard";
import { MoneyFlowCard } from "@/components/MoneyFlowCard";
import { SkeletonGrid } from "@/components/ui";
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

      <DashboardAtAGlance />

      <ThisWeeksPlanCard />
    </div>
  );
}
