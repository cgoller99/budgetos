"use client";

import { useMemo } from "react";
import { AllocationSummary } from "@/components/incomePlan/AllocationSummary";
import { Button } from "@/components/ui";
import { cn } from "@/components/ui/cn";
import {
  getAllocationType,
  resolveAllocations,
} from "@/lib/allocation/allocationEngine";
import type { AllocationType } from "@/lib/allocation/types";
import { formatCurrency } from "@/lib/finance/format";
import {
  forecastGoalSavings,
  weeklySavingsFromPaycheckAmount,
} from "@/lib/finance/goalForecast";
import { formatGoalDate } from "@/lib/finance/goals";
import type { SavingsGoal } from "@/lib/finance/types";
import {
  getAllocationSummary,
  type AllocationDraftFields,
} from "@/lib/incomePlan/allocations";
import type { IncomePlanSchedule } from "@/lib/incomePlan/types";

type PaycheckAllocationEditorProps = {
  paycheckAmount: number;
  allocations: AllocationDraftFields[];
  amountInputs: string[];
  percentInputs: string[];
  goals: SavingsGoal[];
  accounts: Array<{ id: string; name: string }>;
  paySchedule: IncomePlanSchedule;
  customIntervalDays: number | null;
  onAmountInput: (index: number, value: string) => void;
  onPercentInput: (index: number, value: string) => void;
  onUpdate: (index: number, patch: Partial<AllocationDraftFields>) => void;
  onAssignGoal: (index: number, goalId: string | null) => void;
  onAddGoal: (goalId: string) => void;
  onAddCategory: () => void;
  onRemove: (index: number) => void;
  onSetMode: (index: number, mode: AllocationType) => void;
};

const fieldClassName =
  "w-full min-h-11 rounded-xl border border-[var(--surface-border)] bg-[var(--background)] px-3 py-2.5 text-base text-[var(--foreground)] outline-none focus:border-[var(--accent)]";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-[var(--text-secondary)]">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums text-[var(--foreground)]">
        {value}
      </dd>
    </div>
  );
}

function GoalAllocationFacts({
  goal,
  plannedAmount,
  paySchedule,
  customIntervalDays,
}: {
  goal: SavingsGoal;
  plannedAmount: number;
  paySchedule: IncomePlanSchedule;
  customIntervalDays: number | null;
}) {
  const stillToSave = Math.max(goal.target - goal.current, 0);
  const weekly =
    weeklySavingsFromPaycheckAmount(
      plannedAmount,
      paySchedule,
      customIntervalDays,
    ) ?? 0;
  const forecast = forecastGoalSavings({
    current: goal.current,
    target: goal.target,
    createdAt: goal.createdAt,
    weeklySavings: weekly,
    contributed: 0,
    paySchedule,
    customIntervalDays,
  });

  return (
    <div className="mt-3" data-goal-allocation={goal.id}>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Fact label="Saved balance" value={formatCurrency(goal.current)} />
        <Fact label="Target" value={formatCurrency(goal.target)} />
        <Fact label="Still to save" value={formatCurrency(stillToSave)} />
        <Fact
          label="Projected finish"
          value={formatGoalDate(forecast.estimatedCompletionDate)}
        />
        <Fact label="Time remaining" value={forecast.timeLabel} />
        <Fact label="From this paycheck" value={formatCurrency(plannedAmount)} />
      </dl>
      <a
        href="/savings"
        className="mt-2 inline-block text-xs font-medium text-[var(--accent-light)] hover:underline"
      >
        Open {goal.name} goal
      </a>
      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
        Planned only — does not change the saved balance until you confirm a paycheck.
      </p>
    </div>
  );
}

export function PaycheckAllocationEditor({
  paycheckAmount,
  allocations,
  amountInputs,
  percentInputs,
  goals,
  accounts,
  paySchedule,
  customIntervalDays,
  onAmountInput,
  onPercentInput,
  onUpdate,
  onAssignGoal,
  onAddGoal,
  onAddCategory,
  onRemove,
  onSetMode,
}: PaycheckAllocationEditorProps) {
  const summary = useMemo(
    () => getAllocationSummary(paycheckAmount, allocations),
    [allocations, paycheckAmount],
  );

  const resolved = useMemo(
    () =>
      resolveAllocations({
        paycheckAmount,
        allocations: allocations.map((item, index) => ({
          ...item,
          id: item.id ?? `draft-${index}`,
          sortOrder: index,
        })),
      }),
    [allocations, paycheckAmount],
  );

  const plannedByGoal = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of resolved) {
      const goalId = item.allocation.goalId;
      if (!goalId) {
        continue;
      }
      totals.set(goalId, (totals.get(goalId) ?? 0) + item.amount);
    }
    return totals;
  }, [resolved]);

  const usedGoalIds = new Set(
    allocations
      .map((item) => item.goalId)
      .filter((goalId): goalId is string => Boolean(goalId)),
  );
  const availableGoals = goals.filter((goal) => !usedGoalIds.has(goal.id));

  return (
    <div className="min-w-0 space-y-3" data-paycheck-allocations>
      <AllocationSummary
        paycheckAmount={paycheckAmount}
        allocations={allocations}
      />

      {summary.isOverAllocated ? (
        <p role="alert" className="text-sm font-medium text-red-400">
          These amounts are over this paycheck by {formatCurrency(summary.overBy)}.
        </p>
      ) : null}
      {summary.percentageTotal > 100 ? (
        <p role="alert" className="text-sm font-medium text-red-400">
          Percents cannot add up to more than 100%.
        </p>
      ) : null}
      {summary.remainingBalanceCount !== 1 ? (
        <p role="alert" className="text-sm font-medium text-[var(--text-secondary)]">
          Choose one row as the leftover amount.
        </p>
      ) : null}

      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
        Add each savings goal and set a dollar amount or a percent. Planning a
        contribution does not change the saved balance. Confirm the paycheck to
        move the money.
      </p>

      {allocations.map((allocation, index) => {
        const mode = getAllocationType(allocation);
        const resolvedAmount = resolved[index]?.amount ?? 0;
        const goal =
          goals.find((item) => item.id === allocation.goalId) ?? null;
        const plannedForGoal = goal ? (plannedByGoal.get(goal.id) ?? 0) : 0;
        const label = allocation.name.trim() || "allocation";

        return (
          <div
            key={allocation.id ?? `allocation-${index}`}
            className="min-w-0 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-subtle)] p-4"
          >
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <input
                  value={allocation.icon}
                  onChange={(event) =>
                    onUpdate(index, { icon: event.target.value })
                  }
                  aria-label={`Icon for ${label}`}
                  className="w-12 shrink-0 rounded-xl border border-[var(--surface-border)] bg-[var(--background)] px-2 py-2 text-center text-lg"
                  maxLength={2}
                />
                <input
                  value={allocation.name}
                  onChange={(event) =>
                    onUpdate(index, { name: event.target.value })
                  }
                  placeholder="Name"
                  aria-label={`Name for allocation ${index + 1}`}
                  className={cn(fieldClassName, "min-w-0 flex-1")}
                />
              </div>

              {mode === "fixed" ? (
                <label className="block min-w-0 lg:w-40">
                  <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                    Dollars
                  </span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">
                      $
                    </span>
                    <input
                      inputMode="decimal"
                      value={amountInputs[index] ?? ""}
                      onChange={(event) =>
                        onAmountInput(index, event.target.value)
                      }
                      placeholder="0"
                      aria-label={`Contribution for ${label}`}
                      className={cn(
                        fieldClassName,
                        "pl-7 text-right tabular-nums",
                      )}
                    />
                  </div>
                </label>
              ) : null}

              {mode === "percentage" ? (
                <label className="block min-w-0 lg:w-40">
                  <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                    Percent
                  </span>
                  <div className="relative">
                    <input
                      inputMode="decimal"
                      value={percentInputs[index] ?? ""}
                      onChange={(event) =>
                        onPercentInput(index, event.target.value)
                      }
                      placeholder="0"
                      aria-label={`Percent of paycheck for ${label}`}
                      className={cn(fieldClassName, "pr-8 text-right tabular-nums")}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]">
                      %
                    </span>
                  </div>
                  <p className="mt-1 text-right text-xs tabular-nums text-[var(--text-secondary)]">
                    {formatCurrency(resolvedAmount)} this paycheck
                  </p>
                </label>
              ) : null}

              {mode === "remaining" ? (
                <div className="min-w-0 lg:w-40 lg:text-right">
                  <p className="text-xs font-medium text-[var(--text-secondary)]">
                    Leftover
                  </p>
                  <p
                    className={cn(
                      "mt-1 text-lg font-semibold tabular-nums",
                      summary.isOverAllocated
                        ? "text-red-400"
                        : "text-[var(--foreground)]",
                    )}
                    data-paycheck-remaining
                  >
                    {formatCurrency(resolvedAmount)}
                  </p>
                </div>
              ) : null}
            </div>

            <div
              className="mt-3 flex flex-wrap gap-2"
              role="group"
              aria-label={`Amount type for ${label}`}
            >
              {(
                [
                  ["fixed", "Dollars"],
                  ["percentage", "Percent"],
                  ["remaining", "Leftover"],
                ] as const
              ).map(([modeOption, modeLabel]) => (
                <Button
                  key={modeOption}
                  type="button"
                  size="lg"
                  variant={mode === modeOption ? "primary" : "secondary"}
                  aria-pressed={mode === modeOption}
                  onClick={() => onSetMode(index, modeOption)}
                >
                  {modeLabel}
                </Button>
              ))}
              {allocations.length > 1 ? (
                <Button
                  type="button"
                  size="lg"
                  variant="ghost"
                  onClick={() => onRemove(index)}
                >
                  Remove
                </Button>
              ) : null}
            </div>

            <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
              <label className="block min-w-0">
                <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                  Savings goal
                </span>
                <select
                  value={allocation.goalId ?? ""}
                  onChange={(event) =>
                    onAssignGoal(index, event.target.value || null)
                  }
                  aria-label={`Savings goal for ${label}`}
                  className={fieldClassName}
                >
                  <option value="">None</option>
                  {goals
                    .filter(
                      (item) =>
                        item.id === allocation.goalId || !usedGoalIds.has(item.id),
                    )
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block min-w-0">
                <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">
                  Account
                </span>
                <select
                  value={allocation.accountId ?? ""}
                  onChange={(event) =>
                    onUpdate(index, {
                      accountId: event.target.value || null,
                    })
                  }
                  aria-label={`Account for ${label}`}
                  className={fieldClassName}
                >
                  <option value="">None</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {goal ? (
              <GoalAllocationFacts
                goal={goal}
                plannedAmount={plannedForGoal}
                paySchedule={paySchedule}
                customIntervalDays={customIntervalDays}
              />
            ) : null}
          </div>
        );
      })}

      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
        <label className="block min-w-0 flex-1">
          <span className="sr-only">Add savings goal</span>
          <select
            aria-label="Add savings goal"
            value=""
            disabled={availableGoals.length === 0}
            onChange={(event) => {
              if (event.target.value) {
                onAddGoal(event.target.value);
              }
            }}
            className={fieldClassName}
          >
            <option value="">
              {goals.length === 0
                ? "No savings goals yet"
                : availableGoals.length === 0
                  ? "All goals are on this paycheck"
                  : "Add savings goal"}
            </option>
            {availableGoals.map((goal) => {
              const stillToSave = Math.max(goal.target - goal.current, 0);
              return (
                <option key={goal.id} value={goal.id}>
                  {goal.name} · saved {formatCurrency(goal.current)} · target{" "}
                  {formatCurrency(goal.target)} · {formatCurrency(stillToSave)}{" "}
                  left
                </option>
              );
            })}
          </select>
        </label>
        <Button
          type="button"
          size="lg"
          variant="secondary"
          className="shrink-0"
          onClick={onAddCategory}
        >
          Add category
        </Button>
      </div>

      {goals.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">
          <a
            href="/goals"
            className="font-medium text-[var(--accent-light)] underline"
          >
            Create a goal
          </a>{" "}
          to plan a paycheck contribution.
        </p>
      ) : null}
    </div>
  );
}
