import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { getAdminOverviewMetrics } from "@/lib/admin/metricsService";

export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  try {
    const overview = await getAdminOverviewMetrics(auth.adminSupabase);
    return NextResponse.json(overview);
  } catch (error) {
    console.error("[admin/overview] Failed", error);
    return NextResponse.json({ error: "Unable to load overview metrics." }, { status: 500 });
  }
}
