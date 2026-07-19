"use client";

import { useEffect, useState } from "react";
import { SmartSuggestionsCard } from "@/components/automation/SmartSuggestionsCard";
import { NextPaycheckCard } from "@/components/incomePlan/NextPaycheckCard";
import { UpcomingIncomeCard } from "@/components/dashboard/UpcomingIncomeCard";
import { Button } from "@/components/ui";
import { dashboardSectionClassName } from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";

export function DashboardMoreSection() {
  const [expanded, setExpanded] = useState(false);
  const { automationSuggestions, incomePlan } = useFinance();

  const hasSuggestions = automationSuggestions.length > 0;
  const hasIncomePlan = Boolean(incomePlan);

  if (!hasSuggestions && !hasIncomePlan) {
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
        </div>
      ) : null}
    </section>
  );
}
