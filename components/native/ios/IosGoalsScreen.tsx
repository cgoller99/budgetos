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
import { IosBottomSheet } from "@/components/native/ios/IosBottomSheet";
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
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);

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
          <IosList>
            {goals.map((goal) => (
              <IosListRow
                key={goal.id}
                title={goal.name}
                subtitle={`${formatCurrency(goal.current)} of ${formatCurrency(goal.target)} · ${goal.percentComplete}%`}
                leading={<IosAvatar fallback={goal.icon || goal.name.slice(0, 1)} tone="warning" />}
                trailing={
                  goal.estimatedCompletionDate
                    ? formatGoalDate(goal.estimatedCompletionDate)
                    : "TBD"
                }
                onClick={() => {
                  void triggerHaptic("selection");
                  setSelectedGoalId(goal.id);
                }}
              />
            ))}
          </IosList>
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

      <IosBottomSheet
        open={selectedGoalId !== null}
        title={goals.find((goal) => goal.id === selectedGoalId)?.name}
        onClose={() => setSelectedGoalId(null)}
      >
        {(() => {
          const goal = goals.find((item) => item.id === selectedGoalId);
          if (!goal) return null;
          return (
            <div>
              <p className="text-center text-[34px] font-semibold leading-none tabular-nums text-[var(--foreground)]">
                {goal.percentComplete}%
              </p>
              <IosProgressBar value={goal.percentComplete} tone="warning" className="mt-4" />
              <div className="mt-4 rounded-[16px] bg-white/[0.04] px-3.5 py-3 text-[14px] text-[var(--text-secondary)]">
                <p>
                  {formatCurrency(goal.current)} saved of {formatCurrency(goal.target)}
                </p>
                <p className="mt-1">{formatCurrency(goal.remaining)} left</p>
                <p className="mt-1">
                  Projected {formatGoalDate(goal.estimatedCompletionDate)}
                </p>
                <p className="mt-1">
                  {formatCurrency(goal.monthlyContribution)} / month · {goal.contributionSourceLabel}
                </p>
              </div>
              <div className="mt-4 flex gap-2">
                {!goal.isComplete ? (
                  <button
                    type="button"
                    className="min-h-12 flex-1 rounded-[14px] bg-[var(--accent)] text-[16px] font-semibold text-white"
                    onClick={() => {
                      void triggerHaptic("light");
                      setMoneyGoal(findGoal(goal.id));
                      setSelectedGoalId(null);
                    }}
                  >
                    Add money
                  </button>
                ) : null}
                <button
                  type="button"
                  className="min-h-12 flex-1 rounded-[14px] bg-white/[0.06] text-[16px] font-semibold text-[var(--foreground)]"
                  onClick={() => {
                    void triggerHaptic("light");
                    setEditGoal(findGoal(goal.id));
                    setSelectedGoalId(null);
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
          );
        })()}
      </IosBottomSheet>
      <CreateGoalModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <AddMoneyModal goal={moneyGoal} onClose={() => setMoneyGoal(null)} />
      <EditGoalModal goal={editGoal} onClose={() => setEditGoal(null)} />
    </IosScreen>
  );
}
