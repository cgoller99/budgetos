"use client";

import { useEffect, useState } from "react";
import { useFinance } from "@/context/FinanceContext";
import { formatCurrency } from "@/lib/finance/format";
import {
  getGoalContributionBreakdown,
  paycheckWeeklyForGoal,
} from "@/lib/finance/goalAnalytics";
import {
  forecastGoalSavings,
  sumGoalContributions,
  weeklySavingsFromContribution,
} from "@/lib/finance/goalForecast";
import { formatGoalDate } from "@/lib/finance/goals";
import type { SavingsGoal } from "@/lib/finance/types";
import { cn } from "@/components/ui/cn";

type GoalForecastPanelProps = {
  goal: SavingsGoal;
  onSave: (weeklySavings: number) => Promise<void>;
};

function ForecastStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

export function GoalForecastPanel({ goal, onSave }: GoalForecastPanelProps) {
  const finance = useFinance();
  const [draft, setDraft] = useState(0);
  const [saving, setSaving] = useState(false);

  const savedWeekly = weeklySavingsFromContribution(goal.autoContribution);
  const paycheckWeekly = paycheckWeeklyForGoal(finance, goal.id);
  const breakdown = getGoalContributionBreakdown(finance, goal);
  const assumedWeekly =
    savedWeekly ??
    Math.round(Math.max(0, breakdown.weeklyContribution - paycheckWeekly) * 100) /
      100;

  useEffect(() => {
    setDraft(assumedWeekly);
  }, [goal.id, savedWeekly, assumedWeekly]);

  const contributed = sumGoalContributions(finance.transactions, goal.id, goal.createdAt);
  const paySchedule = finance.incomePlan?.paySchedule ?? null;
  const customIntervalDays = finance.incomePlan?.customIntervalDays ?? null;
  const forecast = forecastGoalSavings({
    current: goal.current,
    target: goal.target,
    createdAt: goal.createdAt,
    weeklySavings: draft + paycheckWeekly,
    contributed,
    paySchedule,
    customIntervalDays,
  });

  const sliderMax = Math.max(
    50,
    Math.ceil(
      Math.max(assumedWeekly, forecast.remaining > 0 ? forecast.remaining / 52 : 0) * 4,
    ),
  );
  const unchanged = savedWeekly == null ? draft <= 0 : Math.abs(draft - savedWeekly) < 0.01;

  async function savePlan() {
    if (saving || unchanged) {
      return;
    }

    setSaving(true);
    try {
      await onSave(draft);
    } catch {
      // FinanceContext shows the error toast.
    } finally {
      setSaving(false);
    }
  }

  const paceClass =
    forecast.pace === "behind"
      ? "text-[var(--danger)]"
      : forecast.pace === "on_track"
        ? "text-[var(--accent-light)]"
        : "text-[var(--success)]";

  return (
    <div className="mt-4 rounded-[16px] border border-[var(--surface-border)] bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] font-semibold text-[var(--foreground)]">Forecast</p>
        <p className={cn("text-[13px] font-semibold", paceClass)}>{forecast.paceLabel}</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <ForecastStat label="Amount remaining" value={formatCurrency(forecast.remaining)} />
        <ForecastStat
          label="Estimated completion"
          value={formatGoalDate(forecast.estimatedCompletionDate)}
        />
        <ForecastStat label="Time until completion" value={forecast.timeLabel} />
        <ForecastStat
          label="Weekly savings"
          value={`${formatCurrency(forecast.weeklySavings)} / week`}
        />
        <ForecastStat
          label="Monthly savings"
          value={`${formatCurrency(forecast.monthlySavings)} / month`}
        />
        <ForecastStat
          label="Per paycheck"
          value={
            forecast.perPaycheckSavings == null
              ? "No paycheck schedule"
              : `${formatCurrency(forecast.perPaycheckSavings)} / paycheck`
          }
        />
      </div>
      <label className="mt-4 block text-[12px] text-[var(--text-muted)]">
        What if I save more?
        <input
          type="range"
          min={0}
          max={sliderMax}
          step={sliderMax > 1000 ? 5 : 1}
          value={Math.min(draft, sliderMax)}
          aria-label="What if I save more?"
          className="mt-2 w-full accent-[var(--accent)]"
          onChange={(event) => setDraft(Number(event.target.value))}
        />
      </label>
      <p className="mt-1 text-[14px] font-semibold tabular-nums text-[var(--foreground)]">
        {formatCurrency(draft)} / week
      </p>
      <p className="mt-2 text-[12px] leading-snug text-[var(--text-secondary)]">
        This preview stays here until you save the plan. Saving does not move money.
        {paycheckWeekly > 0
          ? ` The finish date includes ${formatCurrency(paycheckWeekly)} / week from your paycheck plan. Saving here only updates the separate weekly schedule — it does not replace the Income Plan allocation.`
          : ""}
      </p>
      <button
        type="button"
        className="mt-3 min-h-11 w-full rounded-[12px] bg-[var(--accent)] text-[15px] font-semibold text-white disabled:opacity-50"
        disabled={saving || unchanged}
        onClick={() => {
          void savePlan();
        }}
      >
        {saving ? "Saving…" : "Save plan"}
      </button>
    </div>
  );
}
