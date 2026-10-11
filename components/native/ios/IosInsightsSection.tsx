"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IosCard, IosSection } from "@/components/native/ios/IosPrimitives";
import { useAuth } from "@/context/AuthContext";
import {
  budgetSuggestionDetail,
  type CategoryBudgetSuggestion,
  type FinancialInsight,
} from "@/lib/automation/financialInsights";
import {
  readSavedCategoryBudgets,
  writeSavedCategoryBudgets,
  type SavedCategoryBudget,
} from "@/lib/automation/savedBudgets";
import { formatCurrency } from "@/lib/finance/format";
import { cn } from "@/components/ui/cn";

type IosInsightsSectionProps = {
  insights: FinancialInsight[];
  budgetSuggestions: CategoryBudgetSuggestion[];
};

export function IosInsightsSection({
  insights,
  budgetSuggestions,
}: IosInsightsSectionProps) {
  const { user } = useAuth();
  const [saved, setSaved] = useState<SavedCategoryBudget[]>([]);

  useEffect(() => {
    setSaved(readSavedCategoryBudgets(user?.id));
  }, [user?.id]);

  function persist(next: SavedCategoryBudget[]) {
    setSaved(next);
    writeSavedCategoryBudgets(user?.id, next);
  }

  function acceptBudget(suggestion: CategoryBudgetSuggestion) {
    persist([
      ...saved.filter((item) => item.category !== suggestion.category),
      { category: suggestion.category, amount: suggestion.amount },
    ]);
  }

  function editBudget(category: string, amount: number) {
    persist(
      saved.map((item) => (item.category === category ? { ...item, amount } : item)),
    );
  }

  if (insights.length === 0 && budgetSuggestions.length === 0 && saved.length === 0) {
    return null;
  }

  return (
    <IosSection title="Insights">
      {insights.length > 0 ? (
        <div className="flex flex-col gap-2">
          {insights.map((insight) => (
            <Link key={insight.id} href={insight.href} className="block active:opacity-90">
              <IosCard padding="md">
                <p
                  className={cn(
                    "text-[15px] font-semibold",
                    insight.tone === "negative"
                      ? "text-[var(--danger)]"
                      : insight.tone === "positive"
                        ? "text-[var(--success)]"
                        : "text-[var(--foreground)]",
                  )}
                >
                  {insight.title}
                </p>
                <p className="mt-1 text-[13px] leading-snug text-[var(--text-muted)]">
                  {insight.detail}
                </p>
              </IosCard>
            </Link>
          ))}
        </div>
      ) : null}

      {budgetSuggestions.length > 0 || saved.length > 0 ? (
        <IosCard padding="md">
          <p className="text-[13px] font-semibold text-[var(--foreground)]">
            Suggested budgets
          </p>
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">
            Built from confirmed spending. Saved on this device until you edit them.
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {saved.map((budget) => (
              <li key={budget.category}>
                <label className="block text-[13px] text-[var(--text-secondary)]">
                  {budget.category}
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={budget.amount}
                    aria-label={`${budget.category} budget`}
                    className="mt-1 min-h-11 w-full rounded-[12px] bg-white/[0.06] px-3 text-[16px] text-[var(--foreground)]"
                    onChange={(event) => {
                      const amount = Number.parseFloat(event.target.value);
                      if (Number.isFinite(amount) && amount >= 0) {
                        editBudget(budget.category, amount);
                      }
                    }}
                  />
                </label>
              </li>
            ))}
            {budgetSuggestions
              .filter(
                (suggestion) =>
                  !saved.some((item) => item.category === suggestion.category),
              )
              .map((suggestion) => (
                <li key={suggestion.category} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-[var(--foreground)]">
                      {suggestion.category} · {formatCurrency(suggestion.amount)}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                      {budgetSuggestionDetail(suggestion)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="min-h-11 shrink-0 rounded-[12px] bg-[var(--accent)] px-3 text-[14px] font-semibold text-white"
                    onClick={() => acceptBudget(suggestion)}
                  >
                    Keep
                  </button>
                </li>
              ))}
          </ul>
        </IosCard>
      ) : null}
    </IosSection>
  );
}
