"use client";

import { Badge, Button, Card, CardContent, ProgressRing } from "@/components/ui";
import { GoalInsightList } from "@/components/goals/GoalInsightList";
import { GoalMilestoneConfetti } from "@/components/goals/GoalMilestoneConfetti";
import { GoalTimelineChart } from "@/components/goals/GoalTimelineChart";
import { formatCurrency } from "@/lib/finance/format";
import { formatGoalDate, type GoalProgress } from "@/lib/finance/goals";
import { getGoalTypeMeta } from "@/lib/finance/goalTypes";
import { cn } from "@/components/ui/cn";

type GoalCardProps = {
  goal: GoalProgress;
  onAddMoney: () => void;
  onEdit: () => void;
};

export function GoalCard({ goal, onAddMoney, onEdit }: GoalCardProps) {
  const typeMeta = getGoalTypeMeta(goal.type);

  return (
    <Card hover className="goal-card-enter relative overflow-hidden">
      <GoalMilestoneConfetti
        goalId={goal.id}
        percentComplete={goal.percentComplete}
      />
      <CardContent>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex items-start gap-5">
            <ProgressRing
              value={goal.percentComplete}
              size={112}
              accentColor={goal.accentColor}
            >
              <div className="text-center">
                <span className="text-xl">{goal.icon}</span>
                <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--foreground)]">
                  {goal.percentComplete}%
                </p>
              </div>
            </ProgressRing>

            <div className="min-w-0 flex-1">
              <h3 className="truncate text-lg font-semibold tracking-tight text-[var(--foreground)]">
                {goal.name}
              </h3>
              <Badge
                variant="accent"
                className="mt-3"
                style={{ borderColor: `${goal.accentColor}40` }}
              >
                {typeMeta.label}
              </Badge>

              <p className="mt-5 text-2xl font-semibold tabular-nums text-[var(--foreground)]">
                {formatCurrency(goal.current)}
                <span className="text-base font-normal text-[var(--text-muted)]">
                  {" "}
                  / {formatCurrency(goal.target)}
                </span>
              </p>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {goal.isComplete
                  ? "Goal complete"
                  : `${formatCurrency(goal.remaining)} remaining`}
              </p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Projected finish: {formatGoalDate(goal.estimatedCompletionDate)}
              </p>
            </div>
          </div>

          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <DetailStat label="Current balance" value={formatCurrency(goal.current)} />
            <DetailStat label="Target balance" value={formatCurrency(goal.target)} />
            <DetailStat label="Remaining" value={formatCurrency(goal.remaining)} />
            <DetailStat label="Complete" value={`${goal.percentComplete}%`} />
            <DetailStat
              label="Weekly contribution"
              value={formatCurrency(goal.weeklyContribution)}
            />
            <DetailStat
              label="Monthly contribution"
              value={formatCurrency(goal.monthlyContribution)}
            />
            <DetailStat
              label="Contribution source"
              value={goal.contributionSourceLabel}
              className="sm:col-span-2"
            />
          </div>
        </div>

        {goal.suggestions.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {goal.suggestions.map((suggestion) => (
              <span
                key={suggestion.id}
                className="rounded-full border border-[var(--accent)]/20 bg-[var(--accent)]/8 px-3 py-1.5 text-xs text-[var(--text-secondary)]"
              >
                {suggestion.message}
              </span>
            ))}
          </div>
        )}

        <GoalInsightList insights={goal.insights} className="mt-4" />

        <div className="mt-6">
          <p className="mb-3 text-sm font-medium text-[var(--foreground)]">
            Contribution history
          </p>
          <GoalTimelineChart timeline={goal.timeline} />
        </div>

        <div className="mt-8 flex gap-3 border-t border-[var(--surface-border)] pt-6">
          <Button
            type="button"
            fullWidth
            onClick={onAddMoney}
            disabled={goal.isComplete}
          >
            Add contribution
          </Button>
          <Button type="button" variant="secondary" fullWidth onClick={onEdit}>
            Edit goal
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailStat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-3 py-2.5",
        className,
      )}
    >
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}
