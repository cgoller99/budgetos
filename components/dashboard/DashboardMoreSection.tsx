"use client";

import { useState } from "react";
import { SmartSuggestionsCard } from "@/components/automation/SmartSuggestionsCard";
import { NextPaycheckCard } from "@/components/incomePlan/NextPaycheckCard";
import { UpcomingIncomeCard } from "@/components/dashboard/UpcomingIncomeCard";
import { ThisWeeksPlanCard } from "@/components/dashboard/ThisWeeksPlanCard";
import { Button } from "@/components/ui";
import { dashboardSectionClassName } from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";

export function DashboardMoreSection() {
  const [expanded, setExpanded] = useState(false);
  const { dashboard, automationSuggestions, incomePlan } = useFinance();

  const hasSuggestions = automationSuggestions.length > 0;
  const hasWeeklyPlan = dashboard.weeklyPlan.length > 0;
  const hasIncomePlan = Boolean(incomePlan);

  if (!hasSuggestions && !hasWeeklyPlan && !hasIncomePlan) {
    return null;
  }

  return (
    <section className="space-y-5">
      <div className="flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Show less" : "View more"}
        </Button>
      </div>

      {expanded ? (
        <div className={dashboardSectionClassName}>
          <NextPaycheckCard />
          <UpcomingIncomeCard />
          {hasSuggestions ? <SmartSuggestionsCard /> : null}
          {hasWeeklyPlan ? (
            <div className="lg:col-span-2">
              <ThisWeeksPlanCard />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
