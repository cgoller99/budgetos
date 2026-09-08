import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { getAiTeamCustomerVoice } from "@/lib/ai-team";

export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  try {
    return NextResponse.json(
      await getAiTeamCustomerVoice(auth.adminSupabase),
    );
  } catch (error) {
    console.error("[admin/ai-team/customer-voice] Failed", error);
    return NextResponse.json(
      { error: "Unable to load customer voice." },
      { status: 500 },
    );
  }
}
