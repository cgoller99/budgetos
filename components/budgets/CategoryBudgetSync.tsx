"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { createBrowserCategoryBudgetSession } from "@/lib/budgets/categoryBudgetClient";

/** Pulls this user's budgets from Supabase into the device cache after sign-in. */
export function CategoryBudgetSync() {
  const { user } = useAuth();

  useEffect(() => {
    void createBrowserCategoryBudgetSession(user?.id).load();
  }, [user?.id]);

  return null;
}
