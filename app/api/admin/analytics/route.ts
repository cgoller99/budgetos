import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { getAdminAnalyticsMetrics } from "@/lib/admin/metricsService";
import { getAdminDailyRevenueSeries } from "@/lib/admin/revenueService";

export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  try {
    const analytics = await getAdminAnalyticsMetrics(auth.adminSupabase);
    analytics.revenue = await getAdminDailyRevenueSeries();
    return NextResponse.json(analytics);
  } catch (error) {
    console.error("[admin/analytics] Failed", error);
    return NextResponse.json({ error: "Unable to load analytics." }, { status: 500 });
  }
}
