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
  type GoalForecast,
} from "@/lib/finance/goalForecast";
import { formatGoalDate } from "@/lib/finance/goals";
import type { SavingsGoal } from "@/lib/finance/types";
import { cn } from "@/components/ui/cn";

type GoalForecastPanelProps = {
  goal: SavingsGoal;
  /** Tracked progress (linked assigned amount or confirmed ledger). */
  trackedAmount: number;
  /** Shared forecast from enrichGoal when the slider is unchanged. */
  authoritativeForecast: GoalForecast;
  onSave: (weeklySavings: number) => Promise<void>;
  /** Denser layout for native iPhone sheets. */
  compact?: boolean;
};

function ForecastStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-[var(--text-muted)]">{label}</p>
      <p className="mt-0.5 break-words text-[14px] font-semibold tabular-nums text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

export function GoalForecastPanel({
  goal,
  trackedAmount,
  authoritativeForecast,
  onSave,
  compact = false,
}: GoalForecastPanelProps) {
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
  const unchanged =
    savedWeekly == null ? draft <= 0 : Math.abs(draft - savedWeekly) < 0.01;

  const previewWeekly = draft + paycheckWeekly;
  const forecast = unchanged
    ? authoritativeForecast
    : forecastGoalSavings({
        current: trackedAmount,
        target: goal.target,
        createdAt: goal.createdAt,
        weeklySavings: previewWeekly,
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
      : forecast.pace === "insufficient"
        ? "text-[var(--text-muted)]"
        : forecast.pace === "on_track"
          ? "text-[var(--accent-light)]"
          : "text-[var(--success)]";

  const saveDisabledReason = saving
    ? "Saving…"
    : unchanged
      ? savedWeekly == null && draft <= 0
        ? "Adjust the slider to set a weekly schedule, or allocate from Income Plan."
        : "No changes to save — slider matches the current schedule."
      : null;

  const completionValue =
    forecast.weeklySavings > 0
      ? formatGoalDate(forecast.estimatedCompletionDate)
      : "Not estimable yet";

  return (
    <div
      className={cn(
        "goal-forecast-panel rounded-[16px] border border-[var(--surface-border)] bg-white/[0.04]",
        compact ? "p-3" : "p-3 sm:p-4",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] font-semibold text-[var(--foreground)]">Forecast</p>
        <p className={cn("text-[13px] font-semibold", paceClass)}>{forecast.paceLabel}</p>
      </div>
      <div
        className={cn(
          "forecast-stat-grid mt-3 grid min-w-0 gap-2",
          compact ? "grid-cols-2" : "grid-cols-2 sm:gap-3 lg:grid-cols-3",
        )}
      >
        <ForecastStat label="Amount remaining" value={formatCurrency(forecast.remaining)} />
        <ForecastStat label="Estimated completion" value={completionValue} />
        {!compact ? (
          <ForecastStat label="Time until completion" value={forecast.timeLabel} />
        ) : null}
        <ForecastStat
          label="Weekly savings"
          value={`${formatCurrency(forecast.weeklySavings)} / week`}
        />
        <ForecastStat
          label="Monthly savings"
          value={`${formatCurrency(forecast.monthlySavings)} / month`}
        />
        {!compact ? (
          <ForecastStat
            label="Per paycheck"
            value={
              forecast.perPaycheckSavings == null
                ? "No paycheck schedule"
                : `${formatCurrency(forecast.perPaycheckSavings)} / paycheck`
            }
          />
        ) : (
          <ForecastStat
            label="Time left"
            value={forecast.timeLabel}
          />
        )}
      </div>
      <label className="mt-4 block text-[12px] text-[var(--text-muted)]">
        Adjust weekly schedule (preview)
        <input
          type="range"
          min={0}
          max={sliderMax}
          step={sliderMax > 1000 ? 5 : 1}
          value={Math.min(draft, sliderMax)}
          aria-label="Adjust weekly savings schedule"
          className="mt-2 w-full accent-[var(--accent)]"
          onChange={(event) => setDraft(Number(event.target.value))}
        />
      </label>
      <p className="mt-1 text-[14px] font-semibold tabular-nums text-[var(--foreground)]">
        {formatCurrency(draft)} / week schedule
      </p>
      <p className="mt-2 text-[12px] leading-snug text-[var(--text-secondary)]">
        Preview only until you save. Saving does not move money.
        {paycheckWeekly > 0
          ? ` Finish date includes ${formatCurrency(paycheckWeekly)} / week from your paycheck plan. Saving here updates the separate weekly schedule only — it does not replace the Income Plan allocation.`
          : ""}
        {!unchanged
          ? " Moving the slider shows a hypothetical finish date; card insights stay on the saved plan until you save."
          : ""}
      </p>
      <button
        type="button"
        className="mt-3 min-h-11 w-full rounded-[12px] bg-[var(--accent)] text-[15px] font-semibold text-white disabled:opacity-50"
        disabled={saving || unchanged}
        aria-disabled={saving || unchanged}
        title={saveDisabledReason ?? "Save weekly schedule"}
        onClick={() => {
          void savePlan();
        }}
      >
        {saving ? "Saving…" : "Save plan"}
      </button>
      {saveDisabledReason ? (
        <p className="mt-2 text-[12px] text-[var(--text-muted)]">{saveDisabledReason}</p>
      ) : null}
    </div>
  );
}
