"use client";

import Link from "next/link";
import {
  IosCard,
  IosHeroMetric,
  IosList,
  IosListRow,
  IosProgressBar,
  IosScreen,
  IosSection,
  IosSkeletonScreen,
  IosTextButton,
} from "@/components/native/ios/IosPrimitives";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";
import { generateRoadmap } from "@/lib/roadmap";
import { useState } from "react";
import { EventHistoryList } from "@/components/events/EventHistoryList";
import { getRoadmapEvents } from "@/lib/events";
import { triggerHaptic } from "@/lib/native/haptics";

export function IosRoadmapScreen() {
  const finance = useFinance();
  const [showActivity, setShowActivity] = useState(false);

  if (finance.isLoading) {
    return <IosSkeletonScreen rows={4} />;
  }

  const roadmap = generateRoadmap(finance);
  const roadmapEvents = getRoadmapEvents(finance);
  const upcoming = roadmap.milestones.filter((milestone) => !milestone.isComplete);
  const next = roadmap.nextMilestone;

  return (
    <IosScreen>
      <IosHeroMetric
        label="Upcoming milestones"
        value={String(upcoming.length)}
        hint={next ? `Next: ${next.title}` : "You’re caught up"}
      />

      {next ? (
        <IosCard padding="md">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[15px] font-semibold text-[var(--foreground)]">{next.title}</p>
            <p className="text-[13px] tabular-nums text-[var(--text-muted)]">
              {next.percentComplete}%
            </p>
          </div>
          <IosProgressBar value={next.percentComplete} className="mt-2" />
          <p className="mt-2 text-[12px] text-[var(--text-muted)]">
            {formatCurrency(next.remaining)} remaining
          </p>
        </IosCard>
      ) : null}

      <IosSection
        title="Timeline"
        action={
          <Link href="/savings" className="text-[13px] font-semibold text-[var(--accent-light)]">
            Goals
          </Link>
        }
      >
        {roadmap.milestones.length === 0 ? (
          <IosCard padding="md">
            <p className="text-[13px] text-[var(--text-muted)]">
              Create goals to build your money roadmap.
            </p>
          </IosCard>
        ) : (
          <IosList>
            {roadmap.milestones.slice(0, 8).map((milestone) => (
              <IosListRow
                key={milestone.id}
                title={milestone.title}
                subtitle={
                  milestone.isComplete
                    ? "Complete"
                    : `${milestone.percentComplete}% · ${formatCurrency(milestone.remaining)} left`
                }
                trailing={`${milestone.percentComplete}%`}
              />
            ))}
          </IosList>
        )}
      </IosSection>

      <IosSection
        title="Activity"
        action={
          <IosTextButton
            onClick={() => {
              void triggerHaptic("selection");
              setShowActivity((current) => !current);
            }}
          >
            {showActivity ? "Hide" : "View Details"}
          </IosTextButton>
        }
      >
        {showActivity ? (
          <IosCard padding="md">
            <EventHistoryList
              items={roadmapEvents}
              emptyMessage="Complete goals or reach milestones to see activity here."
            />
          </IosCard>
        ) : (
          <IosCard padding="md">
            <p className="text-[13px] text-[var(--text-muted)]">
              Milestone history stays behind View Details.
            </p>
          </IosCard>
        )}
      </IosSection>
    </IosScreen>
  );
}
