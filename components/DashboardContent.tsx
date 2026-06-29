"use client";

import { RecommendedSteps } from "@/components/guidance/RecommendedSteps";
import { WelcomeChecklist } from "@/components/guidance/WelcomeChecklist";
import { HealthScoreCard } from "@/components/HealthScoreCard";
import { MoneyFlowCard } from "@/components/MoneyFlowCard";
import { NextPaycheckCard } from "@/components/incomePlan/NextPaycheckCard";
import { NextGoalCard } from "@/components/dashboard/NextGoalCard";
import { UpcomingBillsCard } from "@/components/dashboard/UpcomingBillsCard";
import { UpcomingIncomeCard } from "@/components/dashboard/UpcomingIncomeCard";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { SmartInsights } from "@/components/SmartInsights";
import { SkeletonGrid } from "@/components/ui";
import {
  dashboardSectionClassName,
  pageContainerWideClassName,
} from "@/components/ui/tokens";
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
      <div className="grid gap-4">
        <WelcomeChecklist />
        <RecommendedSteps />
      </div>

      <div className={dashboardSectionClassName}>
        <MoneyFlowCard />
        <HealthScoreCard />
      </div>

      <div className={dashboardSectionClassName}>
        <NextPaycheckCard />
        <UpcomingIncomeCard />
      </div>

      <div className={dashboardSectionClassName}>
        <UpcomingBillsCard />
        <NextGoalCard />
      </div>

      <div className={dashboardSectionClassName}>
        <SmartInsights />
      </div>
    </div>
  );
}
