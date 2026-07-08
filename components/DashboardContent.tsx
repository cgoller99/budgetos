"use client";

import dynamic from "next/dynamic";
import { MobileSafeToSpendCard } from "@/components/dashboard/MobileSafeToSpendCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { SmartSuggestionsCard } from "@/components/automation/SmartSuggestionsCard";
import { RecommendedSteps } from "@/components/guidance/RecommendedSteps";
import { WelcomeChecklist } from "@/components/guidance/WelcomeChecklist";
import { HealthScoreCard } from "@/components/HealthScoreCard";
import { NextPaycheckCard } from "@/components/incomePlan/NextPaycheckCard";
import { TopGoalsCard } from "@/components/dashboard/TopGoalsCard";
import { UpcomingBillsCard } from "@/components/dashboard/UpcomingBillsCard";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardSkeleton, SkeletonCard } from "@/components/ui";
import { MobileCollapsibleSection } from "@/components/ui/MobileCollapsibleSection";
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
      {/* Mobile: priority stack */}
      <div className="space-y-4 lg:hidden">
        <MobileSafeToSpendCard />
        <NextPaycheckCard />
        <UpcomingBillsCard />
        <TopGoalsCard />
        <RecentActivityCard />

        <MobileCollapsibleSection
          title="Getting started"
          description="Checklist and recommended next steps"
        >
          <div className="space-y-4">
            <WelcomeChecklist />
            <RecommendedSteps />
          </div>
        </MobileCollapsibleSection>

        <MobileCollapsibleSection
          title="Money flow"
          description="Income, spending, and safe-to-spend breakdown"
        >
          <MoneyFlowCard />
        </MobileCollapsibleSection>

        <MobileCollapsibleSection title="Financial health" description="Score and metrics">
          <HealthScoreCard />
        </MobileCollapsibleSection>

        <MobileCollapsibleSection
          title="Smart suggestions"
          description="Automation ideas from your data"
        >
          <SmartSuggestionsCard />
        </MobileCollapsibleSection>

        <MobileCollapsibleSection title="Insights" description="Trends and recommendations">
          <SmartInsights />
        </MobileCollapsibleSection>
      </div>

      {/* Desktop: full dashboard */}
      <div className="hidden lg:block">
        <DashboardHero />
        <div className="mt-6 grid gap-4">
          <WelcomeChecklist />
          <RecommendedSteps />
        </div>

        <div className={cn(dashboardSectionClassName, "mt-8")}>
          <MoneyFlowCard />
          <HealthScoreCard />
        </div>

        <div className={dashboardSectionClassName}>
          <NextPaycheckCard />
          <SmartSuggestionsCard />
        </div>

        <div className={dashboardSectionClassName}>
          <UpcomingBillsCard />
        </div>

        <div className={dashboardSectionClassName}>
          <TopGoalsCard />
          <RecentActivityCard />
        </div>

        <div className={dashboardSectionClassName}>
          <SmartInsights />
        </div>
      </div>
    </div>
  );
}
