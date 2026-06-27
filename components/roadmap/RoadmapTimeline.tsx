import Link from "next/link";
import {
  MILESTONE_CATEGORY_COLORS,
  MILESTONE_CATEGORY_LABELS,
  type RoadmapMilestone,
} from "@/lib/roadmap";
import { MilestoneProgress } from "@/components/roadmap/MilestoneProgress";
import { cn } from "@/components/ui/cn";

type RoadmapTimelineItemProps = {
  milestone: RoadmapMilestone;
  isLast?: boolean;
  index?: number;
};

export function RoadmapTimelineItem({
  milestone,
  isLast = false,
  index = 0,
}: RoadmapTimelineItemProps) {
  const accent = MILESTONE_CATEGORY_COLORS[milestone.category];

  return (
    <li
      className="roadmap-milestone-enter relative flex gap-5 pb-10 last:pb-0"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="relative flex flex-col items-center">
        <span
          className={cn(
            "relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-lg",
            milestone.isComplete
              ? "border-emerald-500/30 bg-emerald-500/10"
              : "border-white/[0.08] bg-[#111827]",
          )}
          style={
            !milestone.isComplete
              ? { boxShadow: `0 0 24px ${accent}20` }
              : undefined
          }
        >
          {milestone.icon}
        </span>
        {!isLast && (
          <span
            aria-hidden
            className="absolute top-11 h-[calc(100%+1rem)] w-px bg-gradient-to-b from-white/[0.12] to-white/[0.04]"
          />
        )}
      </div>

      <article className="min-w-0 flex-1 rounded-2xl border border-white/[0.06] bg-[#111827]/60 p-5 backdrop-blur-sm transition-colors duration-200 hover:border-white/[0.1]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p
              className="text-xs font-medium uppercase tracking-widest"
              style={{ color: accent }}
            >
              {MILESTONE_CATEGORY_LABELS[milestone.category]}
            </p>
            <h3 className="mt-1 text-base font-semibold text-white">
              {milestone.title}
            </h3>
            <p className="mt-1 text-sm text-white/45">{milestone.subtitle}</p>
          </div>

          {milestone.isComplete && (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
              Complete
            </span>
          )}
        </div>

        <div className="mt-5">
          <MilestoneProgress milestone={milestone} />
        </div>
      </article>
    </li>
  );
}

type RoadmapTimelineProps = {
  milestones: RoadmapMilestone[];
  emptyMessage?: string;
};

export function RoadmapTimeline({
  milestones,
  emptyMessage = "Add goals, track debt, and grow investments to build your roadmap.",
}: RoadmapTimelineProps) {
  if (milestones.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-6 py-12 text-center">
        <p className="text-sm text-white/45">{emptyMessage}</p>
        <Link
          href="/savings"
          className="mt-4 inline-block text-sm text-[#0077ed] hover:underline"
        >
          Create your first goal
        </Link>
      </div>
    );
  }

  return (
    <ol className="relative">
      {milestones.map((milestone, index) => (
        <RoadmapTimelineItem
          key={milestone.id}
          milestone={milestone}
          index={index}
          isLast={index === milestones.length - 1}
        />
      ))}
    </ol>
  );
}
