"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { BudgetScheduleFields } from "@/components/budgets/BudgetScheduleFields";
import { CategoryBudgetStatus } from "@/components/budgets/CategoryBudgetStatus";
import { IosBottomSheet } from "@/components/native/ios/IosBottomSheet";
import { IosCard, IosLink, IosProgressBar, IosSection } from "@/components/native/ios/IosPrimitives";
import { useCategoryBudgets } from "@/components/budgets/useCategoryBudgets";
import {
  BUDGET_FREQUENCY_LABELS,
  budgetLimitLabel,
  currentBudgetPeriod,
  formatBudgetPeriodLabel,
  scheduleForEdit,
  type BudgetFrequency,
  type BudgetSchedule,
} from "@/lib/budgets/budgetPeriod";
import { formatCurrency } from "@/lib/finance/format";
import { triggerHaptic } from "@/lib/native/haptics";

export function IosBudgetsSection() {
  const {
    suggestions,
    views,
    category,
    setCategory,
    amount,
    setAmount,
    monthlyBudgetTotal,
    acceptSuggestion,
    updateBudget,
    removeBudget,
    addBudget,
    frequency,
    anchorDate,
    weekday,
    monthDays,
    intervalDays,
    applyDraftSchedule,
    status,
    syncMessage,
    retry,
  } = useCategoryBudgets();
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [draftLimit, setDraftLimit] = useState("");
  const [draftSchedule, setDraftSchedule] = useState<BudgetSchedule | null>(null);
  const pathname = usePathname();
  const glance = pathname === "/dashboard";
  const editing = views.find((view) => view.category === editingCategory) ?? null;
  const visibleViews = glance ? views.slice(0, 3) : views;
  const uniformMonth = views.every((view) => view.frequency === "monthly");
  const totalSpent = views.reduce((sum, view) => sum + view.spent, 0);
  const totalRemaining = monthlyBudgetTotal - totalSpent;
  const overCount = views.filter((view) => view.overspent).length;

  function openEditor(categoryName: string) {
    const view = views.find((item) => item.category === categoryName);
    if (!view) return;
    void triggerHaptic("selection");
    setEditingCategory(categoryName);
    setDraftLimit(String(view.limit));
    setDraftSchedule({
      frequency: view.frequency,
      anchorDate: view.anchorDate,
      weekday: view.weekday,
      monthDays: view.monthDays,
      intervalDays: view.intervalDays,
    });
  }

  function editDraft(patch: Partial<BudgetSchedule>) {
    setDraftSchedule((current) => scheduleForEdit(current ?? editing, patch));
  }

  function saveLimit() {
    if (!editing || !draftSchedule) return;
    const nextAmount = Number.parseFloat(draftLimit);
    if (!Number.isFinite(nextAmount) || nextAmount < 0) return;
    updateBudget(editing.category, { ...draftSchedule, amount: nextAmount });
    void triggerHaptic("success");
    setEditingCategory(null);
  }

  return (
    <IosSection
      title="Budgets"
      action={glance ? <IosLink href="/budgets">Edit limits</IosLink> : undefined}
    >
      <CategoryBudgetStatus status={status} message={syncMessage} onRetry={retry} />
      {views.length > 0 ? (
        <IosCard padding="md">
          <p className="text-[13px] font-medium text-[var(--text-muted)]">This month</p>
          <p className="mt-1 text-[22px] font-semibold tabular-nums text-[var(--foreground)]">
            {uniformMonth
              ? `${formatCurrency(Math.max(totalRemaining, 0))} left`
              : `${formatCurrency(monthlyBudgetTotal)} budgeted`}
          </p>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            {uniformMonth
              ? `${formatCurrency(totalSpent)} spent of ${formatCurrency(monthlyBudgetTotal)}`
              : "Each category keeps its own period"}
            {overCount > 0
              ? ` · ${overCount} over budget`
              : " · nothing over budget"}
          </p>
        </IosCard>
      ) : null}
      {!glance && suggestions.length > 0 ? (
        <IosCard padding="md">
          <p className="text-[15px] font-semibold text-[var(--foreground)]">
            Suggested limits
          </p>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">
            From your recent spending. Nothing is active until you confirm.
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {suggestions.map((suggestion) => (
              <li key={suggestion.category} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-[var(--foreground)]">
                    {suggestion.category}
                  </p>
                  <p className="text-[12px] text-[var(--text-muted)]">
                    {formatCurrency(suggestion.suggestedLimit)} / month ·{" "}
                    {suggestion.months} months
                  </p>
                </div>
                <button
                  type="button"
                  className="min-h-11 shrink-0 rounded-[12px] bg-[var(--accent)] px-3 text-[14px] font-semibold text-white"
                  onClick={() =>
                    acceptSuggestion(suggestion.category, suggestion.suggestedLimit)
                  }
                >
                  Use this limit
                </button>
              </li>
            ))}
          </ul>
        </IosCard>
      ) : null}

      {visibleViews.map((view) => (
        <IosCard key={view.category} padding="md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold text-[var(--foreground)]">
                {view.category}
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                {view.frequencyLabel} · {view.periodLabel}
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                {formatCurrency(view.limit)} limit · {formatCurrency(view.spent)} spent ·{" "}
                {view.overspent
                  ? `${formatCurrency(Math.abs(view.remaining))} over`
                  : `${formatCurrency(view.remaining)} left`}
              </p>
            </div>
            <button
              type="button"
              className="min-h-11 text-[15px] font-semibold text-[var(--accent-light)]"
              onClick={() => openEditor(view.category)}
            >
              Edit
            </button>
          </div>
          <IosProgressBar
            value={view.progress}
            tone={view.overspent ? "danger" : "accent"}
            className="mt-3"
          />
          {view.alert ? (
            <p className="mt-2 text-[13px] font-medium text-[var(--danger)]">{view.alert}</p>
          ) : null}
          {glance ? null : (
            <button
              type="button"
              className="mt-2 min-h-11 text-[13px] font-semibold text-[var(--danger)]"
              onClick={() => {
                void triggerHaptic("light");
                removeBudget(view.category);
              }}
            >
              Remove
            </button>
          )}
        </IosCard>
      ))}
      {glance && views.length > visibleViews.length ? (
        <p className="px-1 text-[13px] text-[var(--text-muted)]">
          {views.length - visibleViews.length} more on Budgets
        </p>
      ) : null}

      {glance ? null : (
      <IosCard padding="md">
        <form onSubmit={addBudget} className="flex flex-col gap-3">
          <p className="text-[15px] font-semibold text-[var(--foreground)]">Add a budget</p>
          <input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Category"
            aria-label="Budget category"
            className="min-h-11 rounded-[12px] bg-white/[0.06] px-3 text-[16px] text-[var(--foreground)]"
          />
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder={budgetLimitLabel(frequency)}
            aria-label="Budget amount"
            className="min-h-11 rounded-[12px] bg-white/[0.06] px-3 text-[16px] text-[var(--foreground)]"
          />
          <BudgetScheduleFields
            tone="ios"
            idPrefix="ios-new-budget"
            value={{
              frequency,
              anchorDate: anchorDate || null,
              weekday,
              monthDays,
              intervalDays,
            }}
            onChange={applyDraftSchedule}
          />
          <button
            type="submit"
            className="min-h-11 rounded-[12px] bg-[var(--accent)] text-[15px] font-semibold text-white"
          >
            Save budget
          </button>
        </form>
      </IosCard>
      )}
      <IosBottomSheet
        open={editing !== null}
        title={editing ? editing.category : "Budget"}
        onClose={() => setEditingCategory(null)}
        footer={
          <button
            type="button"
            className="min-h-12 w-full rounded-[14px] bg-[var(--accent)] text-[16px] font-semibold text-white"
            onClick={saveLimit}
          >
            Save limit
          </button>
        }
      >
        <div className="flex flex-col gap-3">
          {draftSchedule ? (
            <p className="text-[13px] text-[var(--text-muted)]">
              {BUDGET_FREQUENCY_LABELS[draftSchedule.frequency]} ·{" "}
              {formatBudgetPeriodLabel(currentBudgetPeriod(draftSchedule))}
            </p>
          ) : null}
          <BudgetScheduleFields
            tone="ios"
            idPrefix="ios-edit-budget"
            value={{
              frequency: (draftSchedule?.frequency ?? "monthly") as BudgetFrequency,
              anchorDate: draftSchedule?.anchorDate ?? null,
              weekday: draftSchedule?.weekday ?? null,
              monthDays: draftSchedule?.monthDays ?? null,
              intervalDays: draftSchedule?.intervalDays ?? null,
            }}
            onChange={editDraft}
          />
          <label className="block text-[13px] text-[var(--text-muted)]">
            {budgetLimitLabel(draftSchedule?.frequency ?? "monthly")}
            <input
              type="text"
              inputMode="decimal"
              value={draftLimit}
              aria-label={editing ? `${editing.category} budget` : "Monthly limit"}
              className="mt-2 min-h-12 w-full rounded-[12px] bg-white/[0.06] px-3 text-[16px] text-[var(--foreground)]"
              onChange={(event) => setDraftLimit(event.target.value)}
            />
          </label>
        </div>
      </IosBottomSheet>
    </IosSection>
  );
}
