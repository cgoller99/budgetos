"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { useFinance } from "@/context/FinanceContext";
import {
  buildCategoryBudgetViews,
  suggestCategoryBudgetLimits,
} from "@/lib/budgets/categoryBudgets";
import {
  readSavedCategoryBudgets,
  writeSavedCategoryBudgets,
  type SavedCategoryBudget,
} from "@/lib/automation/savedBudgets";

export function useCategoryBudgets() {
  const finance = useFinance();
  const { user } = useAuth();
  const [saved, setSaved] = useState<SavedCategoryBudget[]>([]);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    setSaved(readSavedCategoryBudgets(user?.id));
  }, [user?.id]);

  function persist(next: SavedCategoryBudget[]) {
    setSaved(next);
    writeSavedCategoryBudgets(user?.id, next);
  }

  const suggestions = useMemo(
    () =>
      suggestCategoryBudgetLimits(finance).filter(
        (item) => !saved.some((budget) => budget.category === item.category),
      ),
    [finance, saved],
  );
  const views = useMemo(
    () => buildCategoryBudgetViews(saved, finance),
    [finance, saved],
  );

  function acceptSuggestion(nextCategory: string, limit: number) {
    persist([
      ...saved.filter((item) => item.category !== nextCategory),
      { category: nextCategory, amount: limit },
    ]);
  }

  function updateAmount(nextCategory: string, nextAmount: number) {
    if (!Number.isFinite(nextAmount) || nextAmount < 0) {
      return;
    }

    persist(
      saved.map((item) =>
        item.category === nextCategory
          ? { ...item, amount: Math.round(nextAmount * 100) / 100 }
          : item,
      ),
    );
  }

  function removeBudget(nextCategory: string) {
    persist(saved.filter((item) => item.category !== nextCategory));
  }

  function addBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = category.trim();
    const limit = Number.parseFloat(amount);
    if (!name || !Number.isFinite(limit) || limit < 0) {
      return;
    }

    acceptSuggestion(name, Math.round(limit * 100) / 100);
    setCategory("");
    setAmount("");
  }

  return {
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
  };
}
