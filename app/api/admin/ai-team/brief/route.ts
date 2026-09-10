import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { logAdminEvent } from "@/lib/admin/eventLog";
import {
  generateAiTeamFounderBrief,
  getLatestAiTeamFounderBrief,
} from "@/lib/ai-team";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  try {
    return NextResponse.json(
      {
        brief: await getLatestAiTeamFounderBrief(
          auth.adminSupabase,
          auth.user.id,
        ),
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[admin/ai-team/brief] Load failed", error);
    return NextResponse.json(
      { error: "Founder brief persistence is not ready." },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}

export async function POST() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  try {
    const { brief } = await generateAiTeamFounderBrief(
      auth.adminSupabase,
      auth.user.id,
    );
    await logAdminEvent(auth.adminSupabase, {
      eventType: "ai_team",
      message: "AI Team founder brief generated",
      metadata: { briefId: brief.id, briefDate: brief.briefDate },
      userId: auth.user.id,
    });
    return NextResponse.json({ brief }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("[admin/ai-team/brief] Generation failed", error);
    return NextResponse.json(
      { error: "Unable to generate founder brief." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
