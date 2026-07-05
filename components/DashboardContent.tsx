"use client";

import dynamic from "next/dynamic";
import { SmartSuggestionsCard } from "@/components/automation/SmartSuggestionsCard";
import { RecommendedSteps } from "@/components/guidance/RecommendedSteps";
import { WelcomeChecklist } from "@/components/guidance/WelcomeChecklist";
import { HealthScoreCard } from "@/components/HealthScoreCard";
import { NextPaycheckCard } from "@/components/incomePlan/NextPaycheckCard";
import { TopGoalsCard } from "@/components/dashboard/TopGoalsCard";
import { UpcomingBillsCard } from "@/components/dashboard/UpcomingBillsCard";
import { UpcomingIncomeCard } from "@/components/dashboard/UpcomingIncomeCard";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardSkeleton, SkeletonCard } from "@/components/ui";
import {
  dashboardSectionClassName,
  pageContainerWideClassName,
} from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";
import { cn } from "@/components/ui/cn";

const MoneyFlowCard = dynamic(
  () =>
    import("@/components/MoneyFlowCard").then((module) => ({
      default: module.MoneyFlowCard,
    })),
  { loading: () => <SkeletonCard className="min-h-[220px]" /> },
);

const SmartInsights = dynamic(
  () =>
    import("@/components/SmartInsights").then((module) => ({
      default: module.SmartInsights,
    })),
  { loading: () => <SkeletonCard className="min-h-[180px]" /> },
);

export function DashboardContent() {
  const { isLoading } = useFinance();

  if (isLoading) {
    return <DashboardSkeleton />;
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
        <SmartSuggestionsCard />
      </div>

      <div className={dashboardSectionClassName}>
        <UpcomingIncomeCard />
        <UpcomingBillsCard />
      </div>

      <div className={dashboardSectionClassName}>
        <TopGoalsCard />
      </div>

      <div className={dashboardSectionClassName}>
        <SmartInsights />
      </div>
    </div>
  );
}
