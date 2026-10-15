"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { trackFirstBudget } from "@/lib/analytics/client";
import { useFinance } from "@/context/FinanceContext";
import {
  roundBudgetCurrency,
  scheduleForEdit,
  storedScheduleFields,
  type BudgetFrequency,
  type BudgetSchedule,
} from "@/lib/budgets/budgetPeriod";
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
  const [frequency, setFrequency] = useState<BudgetFrequency>("monthly");
  const [anchorDate, setAnchorDate] = useState("");
  const [weekday, setWeekday] = useState(1);
  const [monthDays, setMonthDays] = useState<[number, number]>([1, 15]);
  const [intervalDays, setIntervalDays] = useState(14);

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
  const monthlyBudgetTotal = useMemo(
    () =>
      roundBudgetCurrency(
        views.reduce((total, view) => total + view.monthlyEquivalent, 0),
      ),
    [views],
  );

  function budgetFromSchedule(
    categoryName: string,
    nextAmount: number,
    schedule: BudgetSchedule,
  ): SavedCategoryBudget {
    return {
      category: categoryName,
      amount: roundBudgetCurrency(nextAmount),
      ...storedScheduleFields(schedule),
    };
  }

  function acceptSuggestion(nextCategory: string, limit: number) {
    const categoryName = getDisplayCategory(nextCategory);
    persist([
      ...saved.filter((item) => getDisplayCategory(item.category) !== categoryName),
      { category: categoryName, amount: limit },
    ]);
  }

  function updateBudget(
    nextCategory: string,
    patch: Partial<BudgetSchedule> & { amount?: number },
  ) {
    const categoryName = getDisplayCategory(nextCategory);
    const current = saved.find((item) => getDisplayCategory(item.category) === categoryName);
    if (!current) return;
    const nextAmount = patch.amount ?? current.amount;
    if (!Number.isFinite(nextAmount) || nextAmount < 0) return;
    const schedule = scheduleForEdit(current, patch);
    persist(
      saved.map((item) =>
        getDisplayCategory(item.category) === categoryName
          ? budgetFromSchedule(categoryName, nextAmount, schedule)
          : item,
      ),
    );
  }

  function updateAmount(nextCategory: string, nextAmount: number) {
    updateBudget(nextCategory, { amount: nextAmount });
  }

  function applyDraftSchedule(
    patch: Partial<BudgetSchedule>,
  ) {
    const next = scheduleForEdit(
      {
        frequency,
        anchorDate: anchorDate || null,
        weekday,
        monthDays,
        intervalDays,
      },
      patch,
    );
    setFrequency(next.frequency);
    setAnchorDate(next.anchorDate ?? "");
    setWeekday(next.weekday ?? 1);
    setMonthDays(next.monthDays ?? [1, 15]);
    setIntervalDays(next.intervalDays ?? 14);
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

    const schedule = scheduleForEdit(
      {
        frequency,
        anchorDate: anchorDate || null,
        weekday,
        monthDays,
        intervalDays,
      },
      {},
    );
    const categoryName = getDisplayCategory(name);
    persist([
      ...saved.filter((item) => getDisplayCategory(item.category) !== categoryName),
      budgetFromSchedule(categoryName, limit, schedule),
    ]);
    setCategory("");
    setAmount("");
    setFrequency("monthly");
    setAnchorDate("");
    setWeekday(1);
    setMonthDays([1, 15]);
    setIntervalDays(14);
  }

  return {
    suggestions,
    views,
    monthlyBudgetTotal,
    category,
    setCategory,
    amount,
    setAmount,
    frequency,
    anchorDate,
    weekday,
    monthDays,
    intervalDays,
    applyDraftSchedule,
    acceptSuggestion,
    updateAmount,
    updateBudget,
    removeBudget,
    addBudget,
    status: syncState.status,
    syncMessage: syncState.message,
    retry,
  };
}
