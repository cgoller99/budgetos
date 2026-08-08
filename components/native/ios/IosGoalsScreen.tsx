"use client";

import { useMemo, useState } from "react";
import {
  IosAvatar,
  IosCard,
  IosHeroMetric,
  IosList,
  IosListRow,
  IosPrimaryButton,
  IosProgressBar,
  IosScreen,
  IosSection,
  IosSkeletonScreen,
} from "@/components/native/ios/IosPrimitives";
import { AddMoneyModal } from "@/components/goals/AddMoneyModal";
import { CreateGoalModal } from "@/components/goals/CreateGoalModal";
import { EditGoalModal } from "@/components/goals/EditGoalModal";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";
import { formatGoalDate, getGoalProgressList } from "@/lib/finance/goals";
import type { SavingsGoal } from "@/lib/finance/types";
import { triggerHaptic } from "@/lib/native/haptics";

export function IosGoalsScreen() {
  const finance = useFinance();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [moneyGoal, setMoneyGoal] = useState<SavingsGoal | null>(null);
  const [editGoal, setEditGoal] = useState<SavingsGoal | null>(null);

  const goals = useMemo(() => getGoalProgressList(finance), [finance]);
  const totalSaved = useMemo(
    () => goals.reduce((sum, goal) => sum + goal.current, 0),
    [goals],
  );
  const totalTarget = useMemo(
    () => goals.reduce((sum, goal) => sum + goal.target, 0),
    [goals],
  );

  if (finance.isLoading) {
    return <IosSkeletonScreen rows={4} />;
  }

  function findGoal(id: string) {
    return finance.savingsGoals.find((goal) => goal.id === id) ?? null;
  }

  return (
    <IosScreen>
      <IosHeroMetric
        label="Saved toward goals"
        value={formatCurrency(totalSaved)}
        hint={
          totalTarget > 0
            ? `of ${formatCurrency(totalTarget)} target`
            : "Set targets and track progress over time"
        }
        tone="positive"
      />

      {goals.length === 0 ? (
        <IosCard padding="md">
          <p className="text-[15px] font-semibold text-[var(--foreground)]">No goals yet</p>
          <p className="mt-1 text-[13px] leading-snug text-[var(--text-muted)]">
            Goals help you save for something specific without cluttering Home.
          </p>
          <div className="mt-4">
            <IosPrimaryButton
              onClick={() => {
                void triggerHaptic("light");
                setIsCreateOpen(true);
              }}
            >
              Create Goal
            </IosPrimaryButton>
          </div>
        </IosCard>
      ) : (
        <IosSection
          title="Goals"
          action={
            <button
              type="button"
              className="min-h-11 text-[13px] font-semibold text-[var(--accent-light)]"
              onClick={() => {
                void triggerHaptic("light");
                setIsCreateOpen(true);
              }}
            >
              + New
            </button>
          }
        >
          <div className="space-y-3">
            {goals.map((goal) => (
              <IosCard key={goal.id} padding="md">
                <button
                  type="button"
                  className="flex w-full items-start gap-3 text-left"
                  onClick={() => setEditGoal(findGoal(goal.id))}
                >
                  <IosAvatar fallback={goal.icon || goal.name.slice(0, 1)} tone="warning" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">
                        {goal.name}
                      </p>
                      <p className="text-[13px] tabular-nums text-[var(--text-muted)]">
                        {goal.percentComplete}%
                      </p>
                    </div>
                    <IosProgressBar
                      value={goal.percentComplete}
                      tone="warning"
                      className="mt-2"
                    />
                    <p className="mt-2 text-[12px] text-[var(--text-muted)]">
                      {formatCurrency(goal.current)} of {formatCurrency(goal.target)}
                      {goal.estimatedCompletionDate
                        ? ` · target ${formatGoalDate(goal.estimatedCompletionDate)}`
                        : ""}
                    </p>
                  </div>
                </button>
                {!goal.isComplete ? (
                  <button
                    type="button"
                    className="mt-3 min-h-11 w-full rounded-[12px] bg-[var(--accent)]/14 text-[14px] font-semibold text-[var(--accent-light)]"
                    onClick={() => {
                      void triggerHaptic("light");
                      setMoneyGoal(findGoal(goal.id));
                    }}
                  >
                    Add money
                  </button>
                ) : null}
              </IosCard>
            ))}
          </div>
        </IosSection>
      )}

      {goals.length === 0 ? null : (
        <IosList>
          <IosListRow
            title="Create another goal"
            subtitle="Emergency fund, trip, or big purchase"
            leading={<IosAvatar fallback="+" tone="warning" />}
            onClick={() => setIsCreateOpen(true)}
            trailing={<span className="text-[var(--accent-light)]">›</span>}
          />
        </IosList>
      )}

      <CreateGoalModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <AddMoneyModal goal={moneyGoal} onClose={() => setMoneyGoal(null)} />
      <EditGoalModal goal={editGoal} onClose={() => setEditGoal(null)} />
    </IosScreen>
  );
}
