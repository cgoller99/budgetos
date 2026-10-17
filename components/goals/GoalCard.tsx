"use client";

import { useMemo } from "react";
import { Badge, Button, Card, CardContent, ProgressRing } from "@/components/ui";
import { GoalInsightList } from "@/components/goals/GoalInsightList";
import { GoalMilestoneConfetti } from "@/components/goals/GoalMilestoneConfetti";
import { GoalTimelineChart } from "@/components/goals/GoalTimelineChart";
import { GoalForecastPanel } from "@/components/goals/GoalForecastPanel";
import { GoalWhatIfPanel } from "@/components/goals/GoalWhatIfPanel";
import { MobileCollapsibleSection } from "@/components/ui/MobileCollapsibleSection";
import { useFinance } from "@/context/FinanceContext";
import { summarizeAccountGoalShares } from "@/lib/finance/goalAccountLink";
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
  onLinkAccount: () => void;
  onSavePlan: (weeklySavings: number) => Promise<void>;
};

export function GoalCard({
  goal,
  savingsGoal,
  onAddMoney,
  onEdit,
  onLinkAccount,
  onSavePlan,
}: GoalCardProps) {
  const finance = useFinance();
  const typeMeta = getGoalTypeMeta(goal.type);
  const amounts = goal.progressAmounts;
  const forecast = goal.forecast;
  const completionLabel =
    forecast.weeklySavings > 0
      ? formatGoalDate(forecast.estimatedCompletionDate)
      : "Not estimable yet";

  const share = useMemo(() => {
    if (!amounts.linkedAccountId) return null;
    return summarizeAccountGoalShares(finance, amounts.linkedAccountId);
  }, [amounts.linkedAccountId, finance]);

  return (
    <Card hover className="goal-card-enter relative overflow-hidden">
      <GoalMilestoneConfetti
        goalId={goal.id}
        percentComplete={goal.percentComplete}
      />
      <CardContent className="min-w-0 space-y-4">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
          <ProgressRing
            value={goal.percentComplete}
            size={88}
            accentColor={goal.accentColor}
          >
            <div className="text-center">
              <span className="text-lg">{goal.icon}</span>
              <p className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--foreground)]">
                {goal.percentComplete}%
              </p>
            </div>
          </ProgressRing>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="min-w-0 break-words text-lg font-semibold tracking-tight text-[var(--foreground)]">
                {goal.name}
              </h3>
              <Badge
                variant="accent"
                style={{ borderColor: `${goal.accentColor}40` }}
              >
                {typeMeta.label}
              </Badge>
              {amounts.linkedAccountId ? (
                <Badge variant={amounts.linkStale ? "warning" : "accent"}>
                  {amounts.linkStale ? "Linked · stale" : "Linked account"}
                </Badge>
              ) : (
                <Badge variant="default">Manual tracking</Badge>
              )}
            </div>

            <p className="break-words text-2xl font-semibold tabular-nums text-[var(--foreground)]">
              {formatCurrency(goal.current)}
              <span className="text-base font-normal text-[var(--text-muted)]">
                {" "}
                / {formatCurrency(goal.target)}
              </span>
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              {goal.isComplete
                ? "Goal complete"
                : `${formatCurrency(goal.remaining)} remaining · finish ${completionLabel}`}
            </p>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <DetailStat
            label="Confirmed contributions"
            value={formatCurrency(amounts.confirmedContributions)}
            hint="Ledger — not replaced by account balance"
          />
          <DetailStat
            label="Planned contributions"
            value={`${formatCurrency(goal.weeklyContribution)} / week`}
            hint={goal.contributionSourceLabel}
          />
          {amounts.assignedToGoal != null ? (
            <DetailStat
              label="Assigned to this goal"
              value={formatCurrency(amounts.assignedToGoal)}
              hint={
                amounts.linkMode === "full"
                  ? "Remaining unallocated on account"
                  : "Fixed allocation"
              }
            />
          ) : null}
          {amounts.marketChangeEstimate != null ? (
            <DetailStat
              label="Market / other change (est.)"
              value={formatCurrency(amounts.marketChangeEstimate)}
              hint="Not a paycheck contribution"
            />
          ) : null}
        </div>

        {share ? (
          <div
            className={cn(
              "rounded-xl border p-3",
              amounts.linkStale
                ? "border-[var(--warning)]/40 bg-[var(--warning)]/5"
                : "border-[var(--surface-border)] bg-[var(--surface-subtle)]",
            )}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-[var(--foreground)]">
                {amounts.linkedAccountName ?? "Linked account"}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                {amounts.linkStale
                  ? "Stale — last known balance"
                  : amounts.lastRefreshedAt
                    ? `Refreshed ${new Date(amounts.lastRefreshedAt).toLocaleString()}`
                    : "Balance live in app"}
              </p>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <p className="text-[11px] text-[var(--text-muted)]">Total</p>
                <p className="font-semibold tabular-nums text-[var(--foreground)]">
                  {formatCurrency(share.totalBalance)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[var(--text-muted)]">Allocated</p>
                <p className="font-semibold tabular-nums text-[var(--foreground)]">
                  {formatCurrency(share.allocated)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-[var(--text-muted)]">Unallocated</p>
                <p className="font-semibold tabular-nums text-[var(--accent-light)]">
                  {formatCurrency(share.unallocated)}
                </p>
              </div>
            </div>
            {share.shares.length > 1 ? (
              <ul className="mt-2 space-y-1 border-t border-[var(--surface-border)] pt-2 text-xs text-[var(--text-secondary)]">
                {share.shares.map((item) => (
                  <li
                    key={item.goalId}
                    className="flex justify-between gap-2"
                  >
                    <span className="min-w-0 truncate">{item.goalName}</span>
                    <span className="tabular-nums text-[var(--foreground)]">
                      {formatCurrency(item.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {goal.suggestions.length > 0 ? (
          <ul className="space-y-1.5">
            {goal.suggestions.map((suggestion) => (
              <li
                key={suggestion.id}
                className="rounded-lg border border-[var(--accent)]/20 bg-[var(--accent)]/8 px-3 py-2 text-sm leading-snug text-[var(--text-secondary)]"
              >
                {suggestion.message}
              </li>
            ))}
          </ul>
        ) : null}

        <GoalInsightList insights={goal.insights} />

        <div>
          <p className="mb-2 text-sm font-medium text-[var(--foreground)]">
            Contribution history
          </p>
          <GoalTimelineChart timeline={goal.timeline} />
        </div>

        <GoalForecastPanel
          goal={savingsGoal}
          trackedAmount={goal.current}
          authoritativeForecast={forecast}
          onSave={onSavePlan}
        />

        <MobileCollapsibleSection
          title="What-If & horizons"
          description="Test extra savings without changing your plan"
        >
          <GoalWhatIfPanel goal={savingsGoal} trackedAmount={goal.current} />
        </MobileCollapsibleSection>

        <div className="flex flex-col gap-2 border-t border-[var(--surface-border)] pt-4 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            className="sm:min-w-[9rem] sm:flex-1"
            onClick={onAddMoney}
            disabled={goal.isComplete}
          >
            Add contribution
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="sm:min-w-[9rem] sm:flex-1"
            onClick={onEdit}
          >
            Edit goal
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="sm:min-w-[9rem] sm:flex-1"
            onClick={onLinkAccount}
          >
            {amounts.linkedAccountId ? "Manage linked account" : "Link account"}
          </Button>
          <a
            href="/income?tab=plan"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-button)] border border-[var(--surface-border)] px-4 text-sm font-semibold text-[var(--accent-light)] sm:min-w-[9rem] sm:flex-1"
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
  hint,
  stale,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  stale?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] px-3 py-2.5",
        className,
      )}
    >
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p
        className={cn(
          "mt-1 break-words text-sm font-semibold tabular-nums text-[var(--foreground)]",
          stale && "text-[var(--warning)]",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 break-words text-[11px] leading-snug text-[var(--text-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
