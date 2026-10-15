"use client";

import { BudgetScheduleFields } from "@/components/budgets/BudgetScheduleFields";
import { CategoryBudgetStatus } from "@/components/budgets/CategoryBudgetStatus";
import { useCategoryBudgets } from "@/components/budgets/useCategoryBudgets";
import { Button, Card, CardContent, CardHeader, Input, ProgressBar } from "@/components/ui";
import { budgetLimitLabel } from "@/lib/budgets/budgetPeriod";
import { formatCurrency } from "@/lib/finance/format";

export function CategoryBudgetsCard() {
  const {
    suggestions,
    views,
    category,
    setCategory,
    amount,
    setAmount,
    monthlyBudgetTotal,
    acceptSuggestion,
    updateAmount,
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

  return (
    <Card>
      <CardHeader
        title="Budgets"
        description="Category limits on the schedule you choose. Suggestions stay off until you confirm."
        action={
          <a
            href="/budgets"
            className="text-sm font-medium text-[var(--accent-light)] hover:underline"
          >
            Open Budgets
          </a>
        }
      />
      <CardContent className="space-y-5">
        <CategoryBudgetStatus status={status} message={syncMessage} onRetry={retry} />
        {suggestions.length > 0 ? (
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">Suggested limits</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              From your recent spending. Nothing is active until you confirm.
            </p>
            <ul className="mt-3 flex flex-col gap-3">
              {suggestions.map((suggestion) => (
                <li key={suggestion.category} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {suggestion.category}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {formatCurrency(suggestion.suggestedLimit)} / month · {suggestion.months}{" "}
                      months
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      acceptSuggestion(suggestion.category, suggestion.suggestedLimit)
                    }
                  >
                    Use this limit
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {views.length > 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            Monthly budget total {formatCurrency(monthlyBudgetTotal)}, on the same monthly basis as Safe to Spend.
          </p>
        ) : null}

        {views.map((view) => (
          <div
            key={view.category}
            className="rounded-[var(--radius-card)] border border-[var(--surface-border)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">{view.category}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {view.frequencyLabel} · {view.periodLabel}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {formatCurrency(view.limit)} limit · {formatCurrency(view.spent)} spent ·{" "}
                  {view.overspent
                    ? `${formatCurrency(Math.abs(view.remaining))} over`
                    : `${formatCurrency(view.remaining)} left`}
                </p>
                {view.frequency === "monthly" ? null : (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    About {formatCurrency(view.monthlyEquivalent)} in a typical month.
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="text"
                size="sm"
                className="text-[var(--danger)]"
                onClick={() => removeBudget(view.category)}
              >
                Remove
              </Button>
            </div>
            <ProgressBar
              value={view.progress}
              variant={view.overspent ? "danger" : "primary"}
              className="mt-3"
            />
            {view.alert ? (
              <p className="mt-2 text-xs font-medium text-[var(--danger)]">{view.alert}</p>
            ) : null}
            <div className="mt-3">
              <BudgetScheduleFields
                tone="web"
                idPrefix={`budget-${view.category}`}
                value={view}
                onChange={(patch) => updateBudget(view.category, patch)}
              />
            </div>
            <label className="mt-3 block text-xs text-[var(--text-muted)]">
              {budgetLimitLabel(view.frequency)}
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={view.limit}
                aria-label={`${view.category} budget`}
                className="mt-1"
                onChange={(event) => {
                  updateAmount(view.category, Number.parseFloat(event.target.value));
                }}
              />
            </label>
          </div>
        ))}

        <form onSubmit={addBudget} className="flex flex-col gap-3">
          <label className="block text-xs text-[var(--text-muted)]">
            Category
            <Input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Groceries"
              aria-label="Budget category"
              className="mt-1"
            />
          </label>
          <label className="block text-xs text-[var(--text-muted)]">
            {budgetLimitLabel(frequency)}
            <Input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="400"
              aria-label="Budget amount"
              className="mt-1"
            />
          </label>
          <div>
            <BudgetScheduleFields
              tone="web"
              idPrefix="new-budget"
              value={{
                frequency,
                anchorDate: anchorDate || null,
                weekday,
                monthDays,
                intervalDays,
              }}
              onChange={applyDraftSchedule}
            />
          </div>
          <Button type="submit" className="self-start">Save budget</Button>
        </form>
      </CardContent>
    </Card>
  );
}
