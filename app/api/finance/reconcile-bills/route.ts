import { NextResponse } from "next/server";
import { reconcileBillPaymentsForUser } from "@/lib/bills/persistBillReconciliation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const userId = await requireAuthenticatedUser(supabase);
    const result = await reconcileBillPaymentsForUser(supabase, userId);

    return NextResponse.json({
      ok: true,
      transactionsLinked: result.reconcile.transactionsLinked,
      billsUpdated: result.reconcile.billsUpdated,
    });
  } catch (error) {
    console.error("[finance/reconcile-bills] Failed", error);
    return NextResponse.json(
      { error: "Unable to reconcile bill payments." },
      { status: 500 },
    );
  }
}
