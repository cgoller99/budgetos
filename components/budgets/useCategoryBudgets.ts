"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { trackFirstBudget } from "@/lib/analytics/client";
import { useFinance } from "@/context/FinanceContext";
import { createBrowserCategoryBudgetSession } from "@/lib/budgets/categoryBudgetClient";
import {
  buildCategoryBudgetViews,
  suggestCategoryBudgetLimits,
} from "@/lib/budgets/categoryBudgets";
import {
  type CategoryBudgetSyncState,
  type SavedCategoryBudget,
} from "@/lib/budgets/categoryBudgetSync";
import { getDisplayCategory } from "@/lib/transactions/categoryPresentation";

const INITIAL_SYNC: CategoryBudgetSyncState = {
  budgets: [],
  status: "loading",
  message: "Loading budgets...",
};

export function useCategoryBudgets() {
  const finance = useFinance();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [syncState, setSyncState] = useState<CategoryBudgetSyncState>(INITIAL_SYNC);
  const [seenUserId, setSeenUserId] = useState<string | null>(userId);
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");

  if (userId !== seenUserId) {
    setSeenUserId(userId);
    setSyncState(INITIAL_SYNC);
  }

  useEffect(() => {
    let cancelled = false;
    const session = createBrowserCategoryBudgetSession(userId);
    setSyncState(session.readLocalState());
    const unsubscribe = session.subscribe((state) => {
      if (!cancelled) {
        setSyncState(state);
      }
    });
    void session.load();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userId]);

  const saved = syncState.budgets;

  function persist(next: SavedCategoryBudget[]) {
    const isFirstBudget =
      syncState.status !== "loading" && saved.length === 0 && next.length > 0;
    const session = createBrowserCategoryBudgetSession(userId);
    setSyncState(session.commit(next));
    if (isFirstBudget) {
      trackFirstBudget("category", userId);
    }
  }

  function retry() {
    const session = createBrowserCategoryBudgetSession(userId);
    void session.load();
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
    status: syncState.status,
    syncMessage: syncState.message,
    retry,
  };
}
