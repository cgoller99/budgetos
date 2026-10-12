"use client";

import { IosCard, IosProgressBar, IosSection } from "@/components/native/ios/IosPrimitives";
import { useCategoryBudgets } from "@/components/budgets/useCategoryBudgets";
import { formatCurrency } from "@/lib/finance/format";

export function IosBudgetsSection() {
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
  } = useCategoryBudgets();

  return (
    <IosSection title="Budgets">
      {suggestions.length > 0 ? (
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

      {views.map((view) => (
        <IosCard key={view.category} padding="md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold text-[var(--foreground)]">
                {view.category}
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                {formatCurrency(view.spent)} spent ·{" "}
                {view.overspent
                  ? `${formatCurrency(Math.abs(view.remaining))} over`
                  : `${formatCurrency(view.remaining)} left`}
              </p>
            </div>
            <button
              type="button"
              className="min-h-11 text-[13px] font-semibold text-[var(--danger)]"
              onClick={() => removeBudget(view.category)}
            >
              Remove
            </button>
          </div>
          <IosProgressBar
            value={view.progress}
            tone={view.overspent ? "danger" : "accent"}
            className="mt-3"
          />
          {view.alert ? (
            <p className="mt-2 text-[12px] font-medium text-[var(--danger)]">{view.alert}</p>
          ) : null}
          <label className="mt-3 block text-[12px] text-[var(--text-muted)]">
            Monthly limit
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={view.limit}
              aria-label={`${view.category} budget`}
              className="mt-1 min-h-11 w-full rounded-[12px] bg-white/[0.06] px-3 text-[16px] text-[var(--foreground)]"
              onChange={(event) => {
                const nextAmount = Number.parseFloat(event.target.value);
                if (Number.isFinite(nextAmount) && nextAmount >= 0) {
                  updateAmount(view.category, nextAmount);
                }
              }}
            />
          </label>
        </IosCard>
      ))}

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
            placeholder="Monthly limit"
            aria-label="Monthly limit"
            className="min-h-11 rounded-[12px] bg-white/[0.06] px-3 text-[16px] text-[var(--foreground)]"
          />
          <button
            type="submit"
            className="min-h-11 rounded-[12px] bg-[var(--accent)] text-[15px] font-semibold text-white"
          >
            Save budget
          </button>
        </form>
      </IosCard>
    </IosSection>
  );
}
