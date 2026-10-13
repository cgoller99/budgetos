"use client";

import { useMemo, useState } from "react";
import { AddMoneyModal } from "@/components/goals/AddMoneyModal";
import { CreateGoalModal } from "@/components/goals/CreateGoalModal";
import { EditGoalModal } from "@/components/goals/EditGoalModal";
import { GoalCard } from "@/components/goals/GoalCard";
import { IosGoalsScreen } from "@/components/native/ios/IosGoalsScreen";
import { Button, EmptyState, PageHeader, SkeletonGrid } from "@/components/ui";
import { pageContainerWideClassName } from "@/components/ui/tokens";
import { useFinance } from "@/context/FinanceContext";
import { getGoalProgressList } from "@/lib/finance/goals";
import type { SavingsGoal } from "@/lib/finance/types";
import { useNativeIos } from "@/lib/native/useNativeIos";
import { cn } from "@/components/ui/cn";

export function GoalsContent() {
  const finance = useFinance();
  const nativeIos = useNativeIos();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [moneyGoal, setMoneyGoal] = useState<SavingsGoal | null>(null);
  const [editGoal, setEditGoal] = useState<SavingsGoal | null>(null);

  const goals = useMemo(
    () => getGoalProgressList(finance),
    [finance],
  );

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
    </div>
  );
}
