"use client";

import { CategoryBudgetStatus } from "@/components/budgets/CategoryBudgetStatus";
import { useCategoryBudgets } from "@/components/budgets/useCategoryBudgets";
import { Button, Card, CardContent, CardHeader, Input, ProgressBar } from "@/components/ui";
import { formatCurrency } from "@/lib/finance/format";

export function CategoryBudgetsCard() {
  const {
    suggestions,
    views,
    category,
    setCategory,
    amount,
    setAmount,
    acceptSuggestion,
    updateAmount,
    removeBudget,
    addBudget,
    status,
    syncMessage,
    retry,
  } = useCategoryBudgets();

  return (
    <Card>
      <CardHeader
        title="Budgets"
        description="Monthly limits by category. Suggestions stay off until you confirm."
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

        {views.map((view) => (
          <div
            key={view.category}
            className="rounded-[var(--radius-card)] border border-[var(--surface-border)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--foreground)]">{view.category}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {formatCurrency(view.spent)} spent ·{" "}
                  {view.overspent
                    ? `${formatCurrency(Math.abs(view.remaining))} over`
                    : `${formatCurrency(view.remaining)} left`}
                </p>
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
            <label className="mt-3 block text-xs text-[var(--text-muted)]">
              Monthly limit
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

        <form onSubmit={addBudget} className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
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
            Monthly limit
            <Input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="400"
              aria-label="Monthly limit"
              className="mt-1"
            />
          </label>
          <Button type="submit">Save budget</Button>
        </form>
      </CardContent>
    </Card>
  );
}
