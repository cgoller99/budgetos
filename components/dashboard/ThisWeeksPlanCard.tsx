"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import { useFinance } from "@/context/FinanceContext";
import { planPriorityClasses } from "@/lib/finance/format";
import { getWeeklyPlanSignature } from "@/lib/intelligence";

export function ThisWeeksPlanCard() {
  const { dashboard } = useFinance();
  const { weeklyPlan } = dashboard;
  const signature = getWeeklyPlanSignature(weeklyPlan);
  const previousSignature = useRef(signature);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (previousSignature.current === signature) {
      return;
    }

    previousSignature.current = signature;
    setIsAnimating(true);

    const timeout = window.setTimeout(() => setIsAnimating(false), 700);
    return () => window.clearTimeout(timeout);
  }, [signature]);

  if (weeklyPlan.length === 0) {
    return null;
  }

  return (
    <Card variant="subtle">
      <CardHeader title="This week" />
      <CardContent>
        <ul
          key={signature}
          className={cn("space-y-3", isAnimating && "plan-list-animate")}
        >
          {weeklyPlan.map((recommendation, index) => (
            <li
              key={recommendation.id}
              className="plan-rec-enter flex gap-3"
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <span
                className={cn(
                  "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
                  planPriorityClasses[recommendation.priority],
                  isAnimating && "scale-110",
                )}
                aria-hidden
              />
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                {recommendation.message}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
