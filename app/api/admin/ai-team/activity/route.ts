import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import {
  listAiTeamActivity,
  listAiTeamActivityByRun,
} from "@/lib/ai-team";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  const searchParams = new URL(request.url).searchParams;
  const operationId = searchParams.get("operationId")?.trim();
  const runId = searchParams.get("runId")?.trim();

  if (
    (operationId && runId) ||
    (!operationId && !runId) ||
    (operationId && !UUID_PATTERN.test(operationId)) ||
    (runId && !UUID_PATTERN.test(runId))
  ) {
    return NextResponse.json(
      { error: "Provide exactly one valid operationId or runId." },
      { status: 400 },
    );
  }

  try {
    const events = operationId
      ? await listAiTeamActivity(
          auth.adminSupabase,
          auth.user.id,
          operationId,
        )
      : await listAiTeamActivityByRun(
          auth.adminSupabase,
          auth.user.id,
          runId!,
        );
    return NextResponse.json(
      { operationId: operationId ?? events[0]?.operationId ?? null, runId: runId ?? events[0]?.runId ?? null, events },
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
