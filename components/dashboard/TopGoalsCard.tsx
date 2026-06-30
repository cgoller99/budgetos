"use client";

import Link from "next/link";
import { Button, Card, CardContent, CardHeader, ProgressRing } from "@/components/ui";
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
      <Card>
        <CardHeader title="Goals" description="Your top active goals" />
        <CardContent>
          <p className="text-sm text-[var(--text-muted)]">
            All goals complete.{" "}
            <Link href="/savings" className="text-[#0077ed] hover:underline">
              Create a new goal
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card hover>
        <CardHeader
          title="Goals"
          description="Your top active goals"
          action={
            <Link
              href="/savings"
              className="text-sm text-[#0077ed] transition-colors hover:underline"
            >
              View all
            </Link>
          }
        />
        <CardContent className="space-y-4">
          {topGoals.map((goal) => (
            <div
              key={goal.id}
              className="flex flex-col gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-4 sm:flex-row sm:items-center"
            >
              <ProgressRing
                value={goal.percentComplete}
                size={76}
                strokeWidth={7}
                accentColor={goal.accentColor}
              >
                <div className="text-center">
                  <span className="text-base">{goal.icon}</span>
                  <p className="text-[10px] font-semibold tabular-nums">
                    {goal.percentComplete}%
                  </p>
                </div>
              </ProgressRing>

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[var(--foreground)]">
                  {goal.name}
                </p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {formatCurrency(goal.remaining)} remaining ·{" "}
                  {formatGoalDate(goal.estimatedCompletionDate)}
                </p>
              </div>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => setMoneyGoal(findGoal(goal.id))}
                disabled={goal.isComplete}
              >
                Add
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <AddMoneyModal goal={moneyGoal} onClose={() => setMoneyGoal(null)} />
    </>
  );
}
