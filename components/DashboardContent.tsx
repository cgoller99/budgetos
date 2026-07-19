"use client";

import dynamic from "next/dynamic";
import { AchievementsCard } from "@/components/dashboard/AchievementsCard";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardMoreSection } from "@/components/dashboard/DashboardMoreSection";
import { DebtOverviewCard } from "@/components/dashboard/DebtOverviewCard";
import { FinancialTrendsCard } from "@/components/dashboard/FinancialTrendsCard";
import { RecentTransactionsCard } from "@/components/dashboard/RecentTransactionsCard";
import { SpendingBreakdownCard } from "@/components/dashboard/SpendingBreakdownCard";
import { TopGoalsCard } from "@/components/dashboard/TopGoalsCard";
import { UpcomingBillsCard } from "@/components/dashboard/UpcomingBillsCard";
import { WeeklyCashFlowCard } from "@/components/dashboard/WeeklyCashFlowCard";
import { WelcomeChecklist } from "@/components/guidance/WelcomeChecklist";
import { DashboardSkeleton } from "@/components/ui";
import {
  dashboardSectionClassName,
  pageContainerWideClassName,
} from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";
import { cn } from "@/components/ui/cn";

export function DashboardContent() {
  const { isLoading } = useFinance();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className={cn(pageContainerWideClassName)}>
      <DashboardHero />
      <WelcomeChecklist />

      <div className={dashboardSectionClassName}>
        <WeeklyCashFlowCard />
        <SpendingBreakdownCard />
      </div>

      <div className={dashboardSectionClassName}>
        <UpcomingBillsCard />
        <TopGoalsCard />
      </div>

      <div className={dashboardSectionClassName}>
        <DebtOverviewCard />
        <RecentTransactionsCard />
      </div>

      <div className={dashboardSectionClassName}>
        <FinancialTrendsCard />
        <AchievementsCard />
      </div>

      <DashboardMoreSection />
    </div>
  );
}
