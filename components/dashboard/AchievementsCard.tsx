"use client";

import { useMemo } from "react";
import { ExpandableCard, PanelLink } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { buildTimeline } from "@/lib/timeline";
import { generateMilestones } from "@/lib/timeline/generateMilestones";
import { formatMilestoneDate } from "@/lib/timeline";

const COMPACT_ITEMS = 2;
const EXPANDED_ITEMS = 6;

function MilestoneList({
  milestones,
  limit,
}: {
  milestones: ReturnType<typeof generateMilestones>;
  limit: number;
}) {
  const items = milestones.slice(0, limit);

  if (items.length === 0) {
    return (
      <p className="py-2 text-xs text-[var(--text-muted)]">
        Milestones appear as you save, invest, and pay down debt.
      </p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {items.map((milestone) => (
        <li key={milestone.id} className="flex items-start gap-2.5">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--surface-hover)] text-sm"
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
  );
}

export function AchievementsCard() {
  const finance = useFinance();

  const milestones = useMemo(() => {
    const timeline = buildTimeline(finance, "monthly");
    return generateMilestones(finance, timeline);
  }, [finance]);

  return (
    <ExpandableCard
      title="Achievements"
      headerAction={<PanelLink href="/reports">View all</PanelLink>}
      summary={<MilestoneList milestones={milestones} limit={COMPACT_ITEMS} />}
      insights={
        milestones.length > 0 ? (
          <p className="text-xs text-[var(--text-muted)]">
            {milestones.length} milestone{milestones.length === 1 ? "" : "s"} on your
            financial journey.
          </p>
        ) : null
      }
    >
      <MilestoneList milestones={milestones} limit={EXPANDED_ITEMS} />
    </ExpandableCard>
  );
}
