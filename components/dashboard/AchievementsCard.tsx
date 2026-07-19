"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, PanelLink } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { buildTimeline } from "@/lib/timeline";
import { generateMilestones } from "@/lib/timeline/generateMilestones";
import { formatMilestoneDate } from "@/lib/timeline";

const MAX_ITEMS = 4;

export function AchievementsCard() {
  const finance = useFinance();

  const milestones = useMemo(() => {
    const timeline = buildTimeline(finance, "monthly");
    return generateMilestones(finance, timeline).slice(0, MAX_ITEMS);
  }, [finance]);

  return (
    <Card hover variant="subtle">
      <CardHeader
        title="Achievements"
        action={<PanelLink href="/reports">View all</PanelLink>}
      />
      <CardContent>
        {milestones.length === 0 ? (
          <p className="py-4 text-sm text-[var(--text-muted)]">
            Milestones appear as you save, invest, and pay down debt.
          </p>
        ) : (
          <ul className="space-y-3">
            {milestones.map((milestone) => (
              <li key={milestone.id} className="flex items-start gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-hover)] text-base"
                  aria-hidden
                >
                  {milestone.icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">
                    {milestone.achievement}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {formatMilestoneDate(milestone.date)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
