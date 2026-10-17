"use client";

import { useMemo, useState } from "react";
import { Button, Input } from "@/components/ui";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";
import {
  getGoalContributionBreakdown,
  paycheckWeeklyForGoal,
} from "@/lib/finance/goalAnalytics";
import {
  sumGoalContributions,
  weeklySavingsFromContribution,
} from "@/lib/finance/goalForecast";
import { buildGoalHorizonProjections } from "@/lib/finance/goalHorizon";
import { formatGoalDate } from "@/lib/finance/goals";
import { simulateGoalWhatIf } from "@/lib/finance/goalWhatIf";
import { calculateMoneyLeftUntilPayday } from "@/lib/finance/moneyLeftUntilPayday";
import { buildPaycheckPlanSummary } from "@/lib/finance/paycheckPlanSummary";
import type { SavingsGoal } from "@/lib/finance/types";

type GoalWhatIfPanelProps = {
  goal: SavingsGoal;
};

export function GoalWhatIfPanel({ goal }: GoalWhatIfPanelProps) {
  const finance = useFinance();
  const [extraWeekly, setExtraWeekly] = useState("10");
  const [extraPerPaycheck, setExtraPerPaycheck] = useState("0");
  const [oneTime, setOneTime] = useState("0");
  const [alternateTarget, setAlternateTarget] = useState(String(goal.target));

  const baselineWeekly = useMemo(() => {
    const saved = weeklySavingsFromContribution(goal.autoContribution) ?? 0;
    const paycheck = paycheckWeeklyForGoal(finance, goal.id);
    if (saved > 0 || paycheck > 0) {
      return Math.round((saved + paycheck) * 100) / 100;
    }
    return getGoalContributionBreakdown(finance, goal).weeklyContribution;
  }, [finance, goal]);

  const contributed = sumGoalContributions(
    finance.transactions,
    goal.id,
    goal.createdAt,
  );
  const paySchedule = finance.incomePlan?.paySchedule ?? null;
  const customIntervalDays = finance.incomePlan?.customIntervalDays ?? null;

  const simulation = useMemo(
    () =>
      simulateGoalWhatIf({
        current: goal.current,
        target: goal.target,
        createdAt: goal.createdAt,
        baselineWeeklySavings: baselineWeekly,
        contributed,
        paySchedule,
        customIntervalDays,
        extraWeekly: Number.parseFloat(extraWeekly) || 0,
        extraPerPaycheck: Number.parseFloat(extraPerPaycheck) || 0,
        oneTimeContribution: Number.parseFloat(oneTime) || 0,
        alternateTarget: Number.parseFloat(alternateTarget) || goal.target,
      }),
    [
      alternateTarget,
      baselineWeekly,
      contributed,
      customIntervalDays,
      extraPerPaycheck,
      extraWeekly,
      goal.createdAt,
      goal.current,
      goal.target,
      oneTime,
      paySchedule,
    ],
  );

  const horizons = useMemo(
    () =>
      buildGoalHorizonProjections({
        current: goal.current + simulation.oneTimeApplied,
        target: simulation.targetUsed,
        weeklySavings: simulation.weeklySavingsUsed,
      }),
    [goal.current, simulation],
  );

  const moneyLeft = useMemo(
    () => calculateMoneyLeftUntilPayday(finance),
    [finance],
  );
  const paycheck = useMemo(() => buildPaycheckPlanSummary(finance), [finance]);
  const extraWeeklyNum = Number.parseFloat(extraWeekly) || 0;
  const affordable =
    moneyLeft.moneyLeftAfterCommitments >= extraWeeklyNum || extraWeeklyNum <= 0;

  return (
    <div className="mt-4 rounded-[16px] border border-[var(--surface-border)] bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] font-semibold text-[var(--foreground)]">What-If simulator</p>
        <p className="text-[12px] text-[var(--text-muted)]">Preview only — not saved</p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-[12px] text-[var(--text-muted)]">
          Extra per week
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="1"
            value={extraWeekly}
            className="mt-1"
            onChange={(event) => setExtraWeekly(event.target.value)}
          />
        </label>
        <label className="block text-[12px] text-[var(--text-muted)]">
          Extra per paycheck
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="1"
            value={extraPerPaycheck}
            className="mt-1"
            onChange={(event) => setExtraPerPaycheck(event.target.value)}
          />
        </label>
        <label className="block text-[12px] text-[var(--text-muted)]">
          One-time contribution
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="1"
            value={oneTime}
            className="mt-1"
            onChange={(event) => setOneTime(event.target.value)}
          />
        </label>
        <label className="block text-[12px] text-[var(--text-muted)]">
          Alternate target
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="1"
            value={alternateTarget}
            className="mt-1"
            onChange={(event) => setAlternateTarget(event.target.value)}
          />
        </label>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Result
          label="Baseline finish"
          value={formatGoalDate(simulation.baseline.estimatedCompletionDate)}
        />
        <Result
          label="Simulated finish"
          value={formatGoalDate(simulation.simulated.estimatedCompletionDate)}
        />
        <Result
          label="Time saved"
          value={
            simulation.daysSaved == null
              ? "Cannot estimate yet"
              : simulation.daysSaved > 0
                ? `${simulation.daysSaved} days`
                : "No earlier finish"
          }
        />
        <Result
          label="Weekly rate used"
          value={`${formatCurrency(simulation.weeklySavingsUsed)} / week`}
        />
      </div>

      <div className="mt-4">
        <p className="text-[12px] font-semibold text-[var(--foreground)]">
          Expected savings (simulated pace)
        </p>
        <ul className="mt-2 grid grid-cols-2 gap-2">
          {horizons.map((horizon) => (
            <li
              key={horizon.days}
              className="rounded-lg border border-[var(--surface-border)] px-2 py-1.5 text-[12px] text-[var(--text-muted)]"
            >
              <span>{horizon.label}</span>
              <p className="font-semibold tabular-nums text-[var(--foreground)]">
                {formatCurrency(horizon.expectedBalance)}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-3 text-[12px] leading-snug text-[var(--text-secondary)]">
        Simulated balances are projections. Actual saved money only changes when you record a
        contribution or confirm a paycheck allocation.
        {paycheck
          ? ` Unallocated paycheck: ${formatCurrency(paycheck.remainingUnallocated)}.`
          : ""}{" "}
        Money left after commitments until payday:{" "}
        {formatCurrency(moneyLeft.moneyLeftAfterCommitments)}.
        {!affordable
          ? " Extra weekly savings may exceed available cash until payday."
          : ""}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            setExtraWeekly("10");
            setExtraPerPaycheck("0");
            setOneTime("0");
            setAlternateTarget(String(goal.target));
          }}
        >
          +$10 / week
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => {
            setExtraWeekly("0");
            setExtraPerPaycheck("50");
            setOneTime("0");
            setAlternateTarget(String(goal.target));
          }}
        >
          +$50 / paycheck
        </Button>
      </div>
    </div>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}
