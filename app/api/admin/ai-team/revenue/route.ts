import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { getAiTeamRevenueIntelligence } from "@/lib/ai-team";

export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  try {
    return NextResponse.json(
      await getAiTeamRevenueIntelligence(auth.adminSupabase),
    );
  } catch (error) {
    console.error("[admin/ai-team/revenue] Failed", error);
    return NextResponse.json(
      { error: "Unable to load revenue intelligence." },
      { status: 500 },
    );
  }
}
