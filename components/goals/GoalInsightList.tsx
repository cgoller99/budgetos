import type { GoalInsight } from "@/lib/finance/goalAnalytics";
import { cn } from "@/components/ui/cn";

type GoalInsightListProps = {
  insights: GoalInsight[];
  className?: string;
};

export function GoalInsightList({ insights, className }: GoalInsightListProps) {
  if (insights.length === 0) {
    return null;
  }

  return (
    <div className={cn("grid gap-2", className)}>
      {insights.map((insight) => (
        <div
          key={insight.id}
          className="rounded-xl border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2.5 text-sm leading-relaxed text-[var(--text-secondary)]"
        >
          {insight.message}
        </div>
      ))}
    </div>
  );
}
