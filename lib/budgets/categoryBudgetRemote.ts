import type { CategoryBudgetRecord, CategoryBudgetRemote } from "@/lib/budgets/categoryBudgetSync";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import { getDisplayCategory } from "@/lib/transactions/categoryPresentation";

function normalizeAmount(value: unknown): number | null {
  const amount = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }
  return Math.round(amount * 100) / 100;
}

/**
 * Owner-scoped access to category_budgets.
 * RLS still requires auth.uid() = user_id; the user id filter keeps the query indexed.
 */
export function createSupabaseCategoryBudgetRemote(
  supabase: BuxmeSupabaseClient,
  userId: string,
): CategoryBudgetRemote {
  return {
    async list() {
      const { data, error } = await supabase
        .from("category_budgets")
        .select("category, amount, updated_at")
        .eq("user_id", userId);

      if (error) {
        throw error;
      }

      const records: CategoryBudgetRecord[] = [];
      for (const row of data ?? []) {
        const amount = normalizeAmount(row.amount);
        const category = getDisplayCategory(row.category);
        if (amount == null || !category || !row.updated_at) {
          continue;
        }
        records.push({
          category,
          amount,
          updatedAt: row.updated_at,
        });
      }
      return records;
    },

    async save(record) {
      const { error } = await supabase.from("category_budgets").upsert(
        {
          user_id: userId,
          category: record.category,
          amount: record.amount,
          updated_at: record.updatedAt,
        },
        { onConflict: "user_id,category" },
      );

      if (error) {
        throw error;
      }
    },

    async remove(category) {
      const { error } = await supabase
        .from("category_budgets")
        .delete()
        .eq("user_id", userId)
        .eq("category", category);

      if (error) {
        throw error;
      }
    },
  };
}
