import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { verifyAppleSubscriptionStatus } from "@/lib/iap/appleSubscriptionStatus";
export const dynamic = "force-dynamic";

/** Explicit, read-only reconciliation on demand; never mutates customer subscriptions. */
export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;
  const { data, error } = await auth.adminSupabase.from("profiles")
    .select("apple_original_transaction_id, subscription_provider")
    .eq("subscription_provider", "apple");
  if (error) return NextResponse.json({ error: "Could not read Apple subscription records" }, { status: 503 });
  const ids = [...new Set((data ?? []).map(row => row.apple_original_transaction_id).filter((id): id is string => Boolean(id)))];
  if (ids.length > 50) return NextResponse.json({ error: "Audit exceeds 50 subscriptions; use paginated reconciliation" }, { status: 413 });
  let activePro = 0, activeProPlus = 0, inactive = 0, unresolved = 0;
  for (const id of ids) {
    try {
      const status = await verifyAppleSubscriptionStatus(id);
      if (!status.active) inactive++;
      else if (status.plan === "pro") activePro++;
      else if (status.plan === "pro_plus") activeProPlus++;
    } catch {
      unresolved++;
    }
  }
  const grossEstimatedMonthly = Number((activePro * 7.99 + activeProPlus * 14.99).toFixed(2));
  return NextResponse.json({
    checkedAt: new Date().toISOString(), source: "apple_server_verified_status",
    activePro, activeProPlus, inactive, unresolved, checked: ids.length,
    grossEstimatedMonthly, verifiedTotalMrr: null,
    note: "Apple verified subscription status, not billed proceeds. Gross monthly estimate assumes US list prices; excludes offers, regional pricing, refunds and commissions. Do not report as verified combined MRR.",
  }, { headers: { "Cache-Control": "no-store" } });
}
