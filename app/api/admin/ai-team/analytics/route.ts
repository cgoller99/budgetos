import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { getAiTeamProductAnalytics } from "@/lib/ai-team";

export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  try {
    return NextResponse.json(
      await getAiTeamProductAnalytics(auth.adminSupabase),
    );
  } catch (error) {
    console.error("[admin/ai-team/analytics] Failed", error);
    return NextResponse.json(
      { error: "Unable to load product intelligence." },
      { status: 500 },
    );
  }
}
