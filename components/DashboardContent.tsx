"use client";

import Link from "next/link";
import { useMemo } from "react";
import { HealthScoreCard } from "@/components/HealthScoreCard";
import { MoneyFlowCard } from "@/components/MoneyFlowCard";
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

      <div className={dashboardSectionClassName}>
        <MoneyFlowCard />
        <HealthScoreCard />
      </div>

      <div className={dashboardSectionClassName}>
        <UpcomingBillsCard />
        <UpcomingIncomeCard />
      </div>

      <div className={dashboardSectionClassName}>
        <NextGoalCard />
        <SmartInsights />
      </div>
    </div>
  );
}
