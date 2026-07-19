"use client";

import Link from "next/link";
import { Button, Card, CardContent, CardHeader, PanelLink, ProgressBar } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";
import { formatGoalDate, getTopGoals } from "@/lib/finance/goals";
import { useMemo, useState } from "react";
import { AddMoneyModal } from "@/components/goals/AddMoneyModal";
import type { SavingsGoal } from "@/lib/finance/types";

export function TopGoalsCard() {
  const finance = useFinance();
  const [moneyGoal, setMoneyGoal] = useState<SavingsGoal | null>(null);

  const topGoals = useMemo(() => getTopGoals(finance, 3), [finance]);

  function findGoal(id: string) {
    return finance.savingsGoals.find((goal) => goal.id === id) ?? null;
  }

  if (topGoals.length === 0) {
    return (
      <Card variant="subtle">
        <CardHeader title="Savings Goals" />
        <CardContent>
          <p className="text-sm text-[var(--text-muted)]">
            <Link href="/savings" className="text-[#0077ed] hover:underline">
              Create a goal
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card hover variant="subtle">
        <CardHeader
          title="Savings Goals"
          action={<PanelLink href="/savings">View all</PanelLink>}
        />
        <CardContent className="space-y-4">
          {topGoals.map((goal) => (
            <div key={goal.id} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-base" aria-hidden>
                    {goal.icon}
                  </span>
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">
                    {goal.name}
                  </p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">
                  {goal.percentComplete}%
                </span>
              </div>
              <ProgressBar value={goal.percentComplete} />
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] text-[var(--text-muted)]">
                  {formatCurrency(goal.remaining)} left ·{" "}
                  {formatGoalDate(goal.estimatedCompletionDate)}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setMoneyGoal(findGoal(goal.id))}
                  disabled={goal.isComplete}
                >
                  Add
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <AddMoneyModal goal={moneyGoal} onClose={() => setMoneyGoal(null)} />
    </>
  );
}
