"use client";

import { Badge, Button, Card, CardContent, ProgressRing } from "@/components/ui";
import { GoalInsightList } from "@/components/goals/GoalInsightList";
import { GoalMilestoneConfetti } from "@/components/goals/GoalMilestoneConfetti";
import { GoalTimelineChart } from "@/components/goals/GoalTimelineChart";
import { GoalForecastPanel } from "@/components/goals/GoalForecastPanel";
import { GoalWhatIfPanel } from "@/components/goals/GoalWhatIfPanel";
import { MobileCollapsibleSection } from "@/components/ui/MobileCollapsibleSection";
import { formatCurrency } from "@/lib/finance/format";
import { formatGoalDate, type GoalProgress } from "@/lib/finance/goals";
import { getGoalTypeMeta } from "@/lib/finance/goalTypes";
import type { SavingsGoal } from "@/lib/finance/types";
import { cn } from "@/components/ui/cn";

type GoalCardProps = {
  goal: GoalProgress;
  savingsGoal: SavingsGoal;
  onAddMoney: () => void;
  onEdit: () => void;
  onSavePlan: (weeklySavings: number) => Promise<void>;
};

export function GoalCard({
  goal,
  savingsGoal,
  onAddMoney,
  onEdit,
  onSavePlan,
}: GoalCardProps) {
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
                Projected finish:{" "}
                {goal.weeklyContribution > 0
                  ? formatGoalDate(goal.estimatedCompletionDate)
                  : "Cannot estimate yet — no reliable contribution schedule"}
              </p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Actual saved balance is separate from planned and projected amounts.
              </p>
            </div>
          </div>

          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <DetailStat label="Actual saved" value={formatCurrency(goal.current)} />
            <DetailStat label="Target amount" value={formatCurrency(goal.target)} />
            <DetailStat label="Amount remaining" value={formatCurrency(goal.remaining)} />
            <DetailStat label="% complete" value={`${goal.percentComplete}%`} />
            <DetailStat
              label="Current contribution rate"
              value={`${formatCurrency(goal.weeklyContribution)} / week`}
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

        <GoalForecastPanel goal={savingsGoal} onSave={onSavePlan} />

        <MobileCollapsibleSection
          title="What-If & horizons"
          description="Test extra savings without changing your plan"
          className="mt-4"
        >
          <GoalWhatIfPanel goal={savingsGoal} />
        </MobileCollapsibleSection>

        <div className="mt-8 flex flex-col gap-3 border-t border-[var(--surface-border)] pt-6 sm:flex-row">
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
          <a
            href="/income?tab=plan"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-button)] border border-[var(--surface-border)] px-4 text-sm font-semibold text-[var(--accent-light)]"
          >
            Edit paycheck allocation
          </a>
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
