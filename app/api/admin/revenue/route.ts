import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { getAdminRevenueMetrics } from "@/lib/admin/revenueService";

export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  try {
    const revenue = await getAdminRevenueMetrics(auth.adminSupabase);
    return NextResponse.json(revenue);
  } catch (error) {
    console.error("[admin/revenue] Failed", error);
    return NextResponse.json({ error: "Unable to load revenue metrics." }, { status: 500 });
  }
}
