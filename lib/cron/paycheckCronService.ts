import "server-only";

import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import { FinanceService } from "@/lib/supabase/services/financeService";

export type PaycheckCronResult = {
  processed: number;
  skipped: number;
  errors: Array<{ userId: string; message: string }>;
};

export async function runDuePaychecks(
  adminSupabase: BuxmeSupabaseClient,
  referenceDate = new Date(),
): Promise<PaycheckCronResult> {
  const today = referenceDate.toISOString().slice(0, 10);

  const { data: duePlans, error } = await adminSupabase
    .from("income_plans")
    .select("id, user_id, next_pay_date, paycheck_amount")
    .eq("is_active", true)
    .lte("next_pay_date", today)
    .gt("paycheck_amount", 0);

  if (error) {
    throw error;
  }

  const service = new FinanceService(adminSupabase);
  const result: PaycheckCronResult = {
    processed: 0,
    skipped: 0,
    errors: [],
  };

  const userIds = [...new Set((duePlans ?? []).map((plan) => plan.user_id))];

  for (const userId of userIds) {
    try {
      await service.markIncomePlanPaycheckReceived(userId);
      result.processed += 1;
    } catch (cronError) {
      result.errors.push({
        userId,
        message:
          cronError instanceof Error ? cronError.message : "Paycheck run failed.",
      });
    }
  }

  return result;
}
