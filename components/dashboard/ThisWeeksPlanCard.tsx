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
    <section>
      <h2 className="mb-7 text-lg font-semibold tracking-tight text-white sm:text-xl">
        This week
      </h2>
      <ul
        key={signature}
        className={cn("space-y-4", isAnimating && "plan-list-animate")}
      >
        {weeklyPlan.map((recommendation, index) => (
          <li
            key={recommendation.id}
            className="plan-rec-enter flex gap-4 rounded-2xl px-1 py-3"
            style={{ animationDelay: `${index * 90}ms` }}
          >
            <span
              className={cn(
                "mt-2 h-2 w-2 shrink-0 rounded-full",
                planPriorityClasses[recommendation.priority],
                isAnimating && "scale-110",
              )}
              aria-hidden
            />
            <p className="text-base leading-relaxed text-white/65">
              {recommendation.message}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
