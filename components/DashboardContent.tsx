"use client";

import { AchievementsCard } from "@/components/dashboard/AchievementsCard";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardMoreSection } from "@/components/dashboard/DashboardMoreSection";
import { FinancialTrendsCard } from "@/components/dashboard/FinancialTrendsCard";
import { RecentTransactionsCard } from "@/components/dashboard/RecentTransactionsCard";
import { SpendingBreakdownCard } from "@/components/dashboard/SpendingBreakdownCard";
import { ThisWeeksPlanCard } from "@/components/dashboard/ThisWeeksPlanCard";
import { TopGoalsCard } from "@/components/dashboard/TopGoalsCard";
import { UpcomingBillsCard } from "@/components/dashboard/UpcomingBillsCard";
import { WeeklyCashFlowCard } from "@/components/dashboard/WeeklyCashFlowCard";
import { WelcomeChecklist } from "@/components/guidance/WelcomeChecklist";
import { IosHomeScreen } from "@/components/native/ios/IosHomeScreen";
import { DashboardSkeleton } from "@/components/ui";
import {
  dashboardCompactSectionClassName,
  dashboardMediumSectionClassName,
  pageContainerWideClassName,
} from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";
import { useNativeIos } from "@/lib/native/useNativeIos";
import { cn } from "@/components/ui/cn";

export function DashboardContent() {
  const { isLoading, dashboard } = useFinance();
  const nativeIos = useNativeIos();

  if (isLoading) {
    return nativeIos ? <IosHomeScreen /> : <DashboardSkeleton />;
  }

  if (nativeIos) {
    return <IosHomeScreen />;
  }

  return (
    <div className={cn(pageContainerWideClassName)}>
      <DashboardHero />
      <WelcomeChecklist />

      <div className={dashboardMediumSectionClassName}>
        <UpcomingBillsCard />
        <RecentTransactionsCard />
        <TopGoalsCard />
      </div>

      <div className={dashboardCompactSectionClassName}>
        <WeeklyCashFlowCard />
        <SpendingBreakdownCard />
        <FinancialTrendsCard />
        <AchievementsCard />
      </div>

      {dashboard.weeklyPlan.length > 0 ? (
        <div id="weekly-plan" className="scroll-mt-24">
          <ThisWeeksPlanCard />
        </div>
      ) : null}

      <DashboardMoreSection />
    </div>
  );
}
