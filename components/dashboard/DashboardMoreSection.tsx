"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { SmartSuggestionsCard } from "@/components/automation/SmartSuggestionsCard";
import { NextPaycheckCard } from "@/components/incomePlan/NextPaycheckCard";
import { UpcomingIncomeCard } from "@/components/dashboard/UpcomingIncomeCard";
import { ThisWeeksPlanCard } from "@/components/dashboard/ThisWeeksPlanCard";
import { Button } from "@/components/ui";
import { dashboardSectionClassName } from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";

const WEEKLY_PLAN_HASH = "#weekly-plan";

function shouldExpandWeeklyPlan(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.location.hash === WEEKLY_PLAN_HASH;
}

function scrollToWeeklyPlan(): void {
  window.requestAnimationFrame(() => {
    document.getElementById("weekly-plan")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  });
}

export function DashboardMoreSection() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(shouldExpandWeeklyPlan);
  const { dashboard, automationSuggestions, incomePlan } = useFinance();

  const hasSuggestions = automationSuggestions.length > 0;
  const hasWeeklyPlan = dashboard.weeklyPlan.length > 0;
  const hasIncomePlan = Boolean(incomePlan);

  useEffect(() => {
    function syncWeeklyPlanSection() {
      if (shouldExpandWeeklyPlan()) {
        setExpanded(true);
      }
    }

    syncWeeklyPlanSection();
    window.addEventListener("hashchange", syncWeeklyPlanSection);
    return () => window.removeEventListener("hashchange", syncWeeklyPlanSection);
  }, [pathname]);

  useEffect(() => {
    if (expanded && shouldExpandWeeklyPlan()) {
      scrollToWeeklyPlan();
    }
  }, [expanded, pathname]);

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
            <div id="weekly-plan" className="scroll-mt-24 lg:col-span-2">
              <ThisWeeksPlanCard />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
