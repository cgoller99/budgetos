"use client";

import { useMemo, useState } from "react";
import { AddMoneyModal } from "@/components/goals/AddMoneyModal";
import { CreateGoalModal } from "@/components/goals/CreateGoalModal";
import { EditGoalModal } from "@/components/goals/EditGoalModal";
import { GoalCard } from "@/components/goals/GoalCard";
import { LinkAccountModal } from "@/components/goals/LinkAccountModal";
import { IosGoalsScreen } from "@/components/native/ios/IosGoalsScreen";
import { Button, Card, CardContent, EmptyState, PageHeader, SkeletonGrid } from "@/components/ui";
import { pageContainerWideClassName } from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";
import { getGoalProgressList } from "@/lib/finance/goals";
import { calculateMoneyLeftUntilPayday } from "@/lib/finance/moneyLeftUntilPayday";
import { buildPaycheckPlanSummary } from "@/lib/finance/paycheckPlanSummary";
import type { SavingsGoal } from "@/lib/finance/types";
import { useNativeIos } from "@/lib/native/useNativeIos";
import { cn } from "@/components/ui/cn";

export function GoalsContent() {
  const finance = useFinance();
  const nativeIos = useNativeIos();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [moneyGoal, setMoneyGoal] = useState<SavingsGoal | null>(null);
  const [editGoal, setEditGoal] = useState<SavingsGoal | null>(null);
  const [linkGoal, setLinkGoal] = useState<SavingsGoal | null>(null);

  const goals = useMemo(
    () => getGoalProgressList(finance),
    [finance],
  );
  const moneyLeft = useMemo(
    () => calculateMoneyLeftUntilPayday(finance),
    [finance],
  );
  const paycheck = useMemo(() => buildPaycheckPlanSummary(finance), [finance]);

  function findGoal(id: string) {
    return finance.savingsGoals.find((goal) => goal.id === id) ?? null;
  }

  async function savePlan(goalId: string, weeklySavings: number) {
    const goal = findGoal(goalId);
    if (!goal) {
      return;
    }

    await finance.editGoal(goalId, {
      name: goal.name,
      type: goal.type,
      target: goal.target,
      weeklySavings,
    });
  }

  if (nativeIos) {
    return <IosGoalsScreen />;
  }

  if (finance.isLoading) {
    return <SkeletonGrid count={3} />;
  }

  return (
    <div className={cn(pageContainerWideClassName)}>
      <PageHeader
        action={
          <Button onClick={() => setIsCreateOpen(true)}>Create goal</Button>
        }
      />

      <Card className="mb-5">
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-[var(--text-muted)]">Money left until payday</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--foreground)]">
              {formatCurrency(moneyLeft.moneyLeftAfterCommitments)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Planned goal savings</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--foreground)]">
              {formatCurrency(moneyLeft.plannedSavingsCommitments)}
            </p>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Paycheck goal allocations</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--foreground)]">
              {paycheck
                ? formatCurrency(paycheck.savingsGoalAllocations)
                : "No Income Plan"}
            </p>
          </div>
        </CardContent>
      </Card>

      {goals.length === 0 ? (
        <EmptyState
          icon="🎯"
          title="No goals yet"
          description="Create your first goal and start building toward what matters."
          actionLabel="Create goal"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {goals.map((goal) => {
            const savingsGoal = findGoal(goal.id);
            if (!savingsGoal) {
              return null;
            }

            return (
              <GoalCard
                key={goal.id}
                goal={goal}
                savingsGoal={savingsGoal}
                onAddMoney={() => setMoneyGoal(savingsGoal)}
                onEdit={() => setEditGoal(savingsGoal)}
                onLinkAccount={() => setLinkGoal(savingsGoal)}
                onSavePlan={(weeklySavings) => savePlan(goal.id, weeklySavings)}
              />
            );
          })}
        </div>
      )}

      <CreateGoalModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
      <AddMoneyModal goal={moneyGoal} onClose={() => setMoneyGoal(null)} />
      <EditGoalModal goal={editGoal} onClose={() => setEditGoal(null)} />
      <LinkAccountModal goal={linkGoal} onClose={() => setLinkGoal(null)} />
    </div>
  );
}
