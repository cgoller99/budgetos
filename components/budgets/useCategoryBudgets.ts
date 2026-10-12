"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { useFinance } from "@/context/FinanceContext";
import {
  buildCategoryBudgetViews,
  suggestCategoryBudgetLimits,
} from "@/lib/budgets/categoryBudgets";
import { getDisplayCategory } from "@/lib/transactions/categoryPresentation";
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
    const categoryName = getDisplayCategory(nextCategory);
    persist([
      ...saved.filter((item) => getDisplayCategory(item.category) !== categoryName),
      { category: categoryName, amount: limit },
    ]);
  }

  function updateAmount(nextCategory: string, nextAmount: number) {
    if (!Number.isFinite(nextAmount) || nextAmount < 0) {
      return;
    }

    const categoryName = getDisplayCategory(nextCategory);
    persist(
      saved.map((item) =>
        getDisplayCategory(item.category) === categoryName
          ? { ...item, category: categoryName, amount: Math.round(nextAmount * 100) / 100 }
          : item,
      ),
    );
  }

  function removeBudget(nextCategory: string) {
    const categoryName = getDisplayCategory(nextCategory);
    persist(saved.filter((item) => getDisplayCategory(item.category) !== categoryName));
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
