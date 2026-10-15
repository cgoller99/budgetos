import { normalizeBudgetSchedule, storedScheduleFields } from "@/lib/budgets/budgetPeriod";
import type { CategoryBudgetRecord, CategoryBudgetRemote } from "@/lib/budgets/categoryBudgetSync";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import { getDisplayCategory } from "@/lib/transactions/categoryPresentation";

const FULL_COLUMNS =
  "category, amount, updated_at, frequency, anchor_date, weekday, month_days, interval_days";
const LEGACY_COLUMNS = "category, amount, updated_at";

type BudgetTableRow = {
  category: string;
  amount: number | string;
  updated_at: string;
  frequency?: string | null;
  anchor_date?: string | null;
  weekday?: number | null;
  month_days?: number[] | string | null;
  interval_days?: number | null;
};

function normalizeAmount(value: unknown): number | null {
  const amount = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }
  return Math.round(amount * 100) / 100;
}

function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42703" || /column .+ does not exist/i.test(error.message ?? "");
}

function toRecord(row: BudgetTableRow): CategoryBudgetRecord | null {
  const amount = normalizeAmount(row.amount);
  const category = getDisplayCategory(row.category);
  if (amount == null || !category || !row.updated_at) {
    return null;
  }
  return {
    category,
    amount,
    updatedAt: row.updated_at,
    ...storedScheduleFields({
      frequency: row.frequency,
      anchorDate: row.anchor_date,
      weekday: row.weekday,
      monthDays: row.month_days,
      intervalDays: row.interval_days,
    }),
  };
}

/**
 * Owner-scoped access to category_budgets.
 * RLS still requires auth.uid() = user_id; the user id filter keeps the query indexed.
 * Schedule columns are additive. Rows that omit them stay monthly.
 */
export function createSupabaseCategoryBudgetRemote(
  supabase: BuxmeSupabaseClient,
  userId: string,
): CategoryBudgetRemote {
  return {
    async list() {
      const full = await supabase
        .from("category_budgets")
        .select(FULL_COLUMNS)
        .eq("user_id", userId);

      const result =
        full.error && isMissingColumn(full.error)
          ? await supabase
              .from("category_budgets")
              .select(LEGACY_COLUMNS)
              .eq("user_id", userId)
          : full;

      if (result.error) {
        throw result.error;
      }

      const records: CategoryBudgetRecord[] = [];
      for (const row of (result.data ?? []) as BudgetTableRow[]) {
        const record = toRecord(row);
        if (record) records.push(record);
      }
      return records;
    },

    async save(record) {
      const schedule = normalizeBudgetSchedule(record);
      const shared = {
        user_id: userId,
        category: record.category,
        amount: record.amount,
        updated_at: record.updatedAt,
      };
      const fullWrite = await supabase.from("category_budgets").upsert(
        {
          ...shared,
          frequency: schedule.frequency,
          anchor_date: schedule.anchorDate,
          weekday: schedule.weekday,
          month_days: schedule.monthDays,
          interval_days: schedule.intervalDays,
        },
        { onConflict: "user_id,category" },
      );

      if (!fullWrite.error) return;
      if (!isMissingColumn(fullWrite.error)) {
        throw fullWrite.error;
      }

      const legacyWrite = await supabase
        .from("category_budgets")
        .upsert(shared, { onConflict: "user_id,category" });
      if (legacyWrite.error) {
        throw legacyWrite.error;
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
