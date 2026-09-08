import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { listAiTeamActivity } from "@/lib/ai-team";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  const operationId = new URL(request.url).searchParams
    .get("operationId")
    ?.trim();

  if (!operationId || !UUID_PATTERN.test(operationId)) {
    return NextResponse.json(
      { error: "A valid operationId is required." },
      { status: 400 },
    );
  }

  try {
    const events = await listAiTeamActivity(
      auth.adminSupabase,
      auth.user.id,
      operationId,
    );
    return NextResponse.json(
      { operationId, events },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[admin/ai-team/activity] Load failed", error);
    return NextResponse.json(
      { error: "Unable to load AI Team activity." },
      { status: 500 },
    );
  }
}
