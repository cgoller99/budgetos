import { formatCurrency } from "@/lib/finance/format";
import {
  formatRoadmapDate,
  MILESTONE_CATEGORY_COLORS,
  MILESTONE_CATEGORY_LABELS,
  type RoadmapMilestone,
} from "@/lib/roadmap";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/components/ui/cn";

type MilestoneProgressProps = {
  milestone: RoadmapMilestone;
  compact?: boolean;
  className?: string;
};

export function MilestoneProgress({
  milestone,
  compact = false,
  className,
}: MilestoneProgressProps) {
  const accent = MILESTONE_CATEGORY_COLORS[milestone.category];

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-white/45">Progress</span>
        <span className="font-medium tabular-nums text-white">
          {milestone.percentComplete}%
        </span>
      </div>

      <ProgressBar value={milestone.percentComplete} />

      {!compact && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-white/40">Current pace</p>
            <p className="mt-1 font-medium text-white/80">{milestone.paceLabel}</p>
          </div>
          <div>
            <p className="text-white/40">Est. completion</p>
            <p className="mt-1 font-medium text-white/80">
              {formatRoadmapDate(milestone.estimatedCompletionDate)}
            </p>
          </div>
          <div>
            <p className="text-white/40">Target date</p>
            <p className="mt-1 font-medium text-white/80">
              {formatRoadmapDate(milestone.targetDate)}
            </p>
          </div>
          <div>
            <p className="text-white/40">Remaining</p>
            <p className="mt-1 font-medium tabular-nums text-white/80">
              {formatCurrency(milestone.remaining)}
            </p>
          </div>
        </div>
      )}

      {compact && (
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: accent }} className="font-medium">
            {milestone.paceLabel}
          </span>
          <span className="text-white/45">
            {formatRoadmapDate(milestone.estimatedCompletionDate)}
          </span>
        </div>
      )}
    </div>
  );
}

export { MILESTONE_CATEGORY_LABELS, MILESTONE_CATEGORY_COLORS };
