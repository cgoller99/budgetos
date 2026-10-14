import "server-only";

import type { BuxmeSupabaseClient } from "@/lib/supabase/client";

export type PaycheckCronResult = {
  processed: number;
  skipped: number;
  errors: Array<{ userId: string; planId?: string; message: string }>;
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

  const result: PaycheckCronResult = {
    processed: 0,
    skipped: 0,
    errors: [],
  };

  // income_plans has no automatic-payday opt-in. is_active only means the plan
  // exists. A due date stays a forecast; Apply paycheck is the confirmation.
  result.skipped = duePlans?.length ?? 0;

  return result;
}
