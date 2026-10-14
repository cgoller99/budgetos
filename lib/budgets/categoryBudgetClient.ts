"use client";

import {
  CategoryBudgetSession,
  type CategoryBudgetRemote,
} from "@/lib/budgets/categoryBudgetSync";
import { createSupabaseCategoryBudgetRemote } from "@/lib/budgets/categoryBudgetRemote";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const sessions = new Map<string, CategoryBudgetSession>();

function remoteForUser(userId: string | null | undefined): CategoryBudgetRemote | null {
  if (!userId || !getSupabaseConfig().isConfigured) {
    return null;
  }

  return createSupabaseCategoryBudgetRemote(getSupabaseBrowserClient(), userId);
}

export function createBrowserCategoryBudgetSession(
  userId: string | null | undefined,
): CategoryBudgetSession {
  const key = userId || "local";
  const existing = sessions.get(key);
  if (existing) {
    return existing;
  }

  const session = new CategoryBudgetSession(key, window.localStorage, remoteForUser(userId));
  sessions.set(key, session);
  return session;
}
