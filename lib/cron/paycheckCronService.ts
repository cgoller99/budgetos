import "server-only";

import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import { getErrorMessage } from "@/lib/supabase/errors";
import { FinanceService } from "@/lib/supabase/services/financeService";

export type PaycheckCronResult = {
  processed: number;
  skipped: number;
  errors: Array<{ userId: string; planId?: string; message: string }>;
};

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.slice(0, 10);
}

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

  for (const plan of duePlans ?? []) {
    const dueDate = normalizeDate(plan.next_pay_date);

    if (!dueDate) {
      result.skipped += 1;
      continue;
    }

    const { data: existingEvent, error: existingError } = await adminSupabase
      .from("income_plan_paycheck_events")
      .select("id")
      .eq("income_plan_id", plan.id)
      .eq("pay_date", dueDate)
      .maybeSingle();

    if (existingError) {
      result.errors.push({
        userId: plan.user_id,
        planId: plan.id,
        message: getErrorMessage(existingError),
      });
      continue;
    }

    if (existingEvent) {
      result.skipped += 1;
      continue;
    }

    try {
      await service.markIncomePlanPaycheckReceived(plan.user_id);
      result.processed += 1;
    } catch (cronError) {
      result.errors.push({
        userId: plan.user_id,
        planId: plan.id,
        message: getErrorMessage(cronError),
      });
    }
  }

  return result;
}
