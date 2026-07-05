import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { getAdminPlaidMetrics } from "@/lib/admin/plaidMetricsService";

export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  try {
    const plaid = await getAdminPlaidMetrics(auth.adminSupabase);
    return NextResponse.json(plaid);
  } catch (error) {
    console.error("[admin/plaid] Failed", error);
    return NextResponse.json({ error: "Unable to load Plaid metrics." }, { status: 500 });
  }
}
