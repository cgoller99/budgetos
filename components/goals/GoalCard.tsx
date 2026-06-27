"use client";

import { Badge, Button, Card, CardContent, ProgressRing } from "@/components/ui";
import { formatCurrency } from "@/lib/finance/format";
import { formatGoalDate, type GoalProgress } from "@/lib/finance/goals";
import { getGoalTypeMeta } from "@/lib/finance/goalTypes";

type GoalCardProps = {
  goal: GoalProgress;
  onAddMoney: () => void;
  onEdit: () => void;
};

export function GoalCard({ goal, onAddMoney, onEdit }: GoalCardProps) {
  const typeMeta = getGoalTypeMeta(goal.type);

  return (
    <Card hover className="goal-card-enter overflow-hidden">
      <CardContent>
        <div className="flex items-start gap-6">
          <ProgressRing value={goal.percentComplete} size={96}>
            <div className="text-center">
              <span className="text-xl">{goal.icon}</span>
              <p className="mt-1 text-sm font-semibold tabular-nums">
                {goal.percentComplete}%
              </p>
            </div>
          </ProgressRing>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-semibold tracking-tight text-white">
              {goal.name}
            </h3>
            <Badge variant="accent" className="mt-3">
              {typeMeta.label}
            </Badge>

            <p className="mt-6 text-base text-white/55">
              <span className="font-medium tabular-nums text-white">
                {formatCurrency(goal.current)}
              </span>
              <span className="text-white/35"> of </span>
              <span className="font-medium tabular-nums text-white/80">
                {formatCurrency(goal.target)}
              </span>
            </p>
            <p className="mt-2 text-sm text-white/38">
              {goal.isComplete
                ? "Complete"
                : `${formatCurrency(goal.remaining)} left · ${formatGoalDate(goal.estimatedCompletionDate)}`}
            </p>
          </div>
        </div>

        <div className="mt-8 flex gap-3 border-t border-white/[0.04] pt-6">
          <Button
            type="button"
            fullWidth
            onClick={onAddMoney}
            disabled={goal.isComplete}
          >
            Add money
          </Button>
          <Button type="button" variant="secondary" fullWidth onClick={onEdit}>
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
