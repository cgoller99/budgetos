"use client";

import Link from "next/link";
import { RoadmapTimeline } from "@/components/roadmap/RoadmapTimeline";
import { EventHistoryList } from "@/components/events/EventHistoryList";
import { Card, CardContent, CardHeader, SkeletonGrid } from "@/components/ui";
import { pageContainerClassName } from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";
import { getRoadmapEvents } from "@/lib/events";
import { formatCurrency } from "@/lib/finance/format";
import { generateRoadmap } from "@/lib/roadmap";
import { cn } from "@/components/ui/cn";

export function RoadmapContent() {
  const finance = useFinance();

  if (finance.isLoading) {
    return <SkeletonGrid count={3} />;
  }

  const roadmap = generateRoadmap(finance);
  const roadmapEvents = getRoadmapEvents(finance);
  const upcomingCount = roadmap.milestones.filter(
    (milestone) => !milestone.isComplete,
  ).length;

  return (
    <div className={cn(pageContainerClassName)}>
      <section className="space-y-8">
        <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
          <div>
            <p className="text-sm text-white/38">Upcoming</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-white">
              {upcomingCount}
            </p>
          </div>
          {roadmap.nextMilestone && (
            <>
              <div className="hidden h-8 w-px bg-white/[0.06] sm:block" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white/38">Next</p>
                <p className="mt-2 truncate text-xl font-medium text-white">
                  {roadmap.nextMilestone.title}
                </p>
              </div>
            </>
          )}
        </div>

        {roadmap.nextMilestone && (
          <p className="text-base text-white/40">
            {roadmap.nextMilestone.percentComplete}% complete ·{" "}
            {formatCurrency(roadmap.nextMilestone.remaining)} remaining
          </p>
        )}
      </section>

      <section>
        <div className="mb-7 flex items-center justify-between gap-4">
          <h2 className="text-xl font-semibold tracking-tight text-white">
            Timeline
          </h2>
          <Link
            href="/savings"
            className="text-sm text-white/40 transition-colors hover:text-white/70"
          >
            Contributions
          </Link>
        </div>

        <RoadmapTimeline milestones={roadmap.milestones} />
      </section>

      <Card padding="lg">
        <CardHeader title="Milestone activity" />
        <CardContent>
          <EventHistoryList
            items={roadmapEvents}
            emptyMessage="Complete goals or reach net worth milestones to see activity here."
          />
        </CardContent>
      </Card>
    </div>
  );
}
