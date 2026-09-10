import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import {
  listRecentAiTeamMissions,
  loadAiTeamMission,
  loadAiTeamMissionByOperation,
  requestAiTeamMissionStop,
  requestAiTeamOperationStop,
} from "@/lib/ai-team";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

export async function GET(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  const searchParams = new URL(request.url).searchParams;
  const id = searchParams.get("id")?.trim();
  const operationId = searchParams.get("operationId")?.trim();
  if (
    (id && operationId) ||
    (id && !UUID_PATTERN.test(id)) ||
    (operationId && !UUID_PATTERN.test(operationId))
  ) {
    return NextResponse.json(
      { error: "Provide one valid mission id or operationId." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    if (id) {
      const mission = await loadAiTeamMission(
        auth.adminSupabase,
        auth.user.id,
        id,
      );
      return NextResponse.json({ mission }, { headers: NO_STORE_HEADERS });
    }
    if (operationId) {
      const mission = await loadAiTeamMissionByOperation(
        auth.adminSupabase,
        auth.user.id,
        operationId,
      );
      return NextResponse.json({ mission }, { headers: NO_STORE_HEADERS });
    }
    const missions = await listRecentAiTeamMissions(
      auth.adminSupabase,
      auth.user.id,
    );
    return NextResponse.json({ missions }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("[admin/ai-team/missions] Load failed", error);
    return NextResponse.json(
      { error: "Unable to load AI Team missions." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;
  const body = (await request.json().catch(() => null)) as
    | { id?: unknown; operationId?: unknown; action?: unknown }
    | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const operationId =
    typeof body?.operationId === "string" ? body.operationId.trim() : "";
  if (
    Boolean(id) === Boolean(operationId) ||
    (id && !UUID_PATTERN.test(id)) ||
    (operationId && !UUID_PATTERN.test(operationId)) ||
    (body?.action !== "stop" && body?.action !== "kill")
  ) {
    return NextResponse.json(
      { error: "Provide exactly one valid mission id or operationId with a stop action." },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    if (operationId) {
      await requestAiTeamOperationStop(
        auth.adminSupabase,
        auth.user.id,
        operationId,
      );
    }
    const resolvedMission = id
      ? await loadAiTeamMission(auth.adminSupabase, auth.user.id, id)
      : await loadAiTeamMissionByOperation(
          auth.adminSupabase,
          auth.user.id,
          operationId,
        );
    if (!resolvedMission) {
      return NextResponse.json(
        {
          mission: null,
          stopRecorded: true,
          serverStopGuaranteed: false,
          message:
            "Stop request recorded for this operation. If server work has not created the mission yet, it will observe the request before continuing.",
        },
        { status: 202, headers: NO_STORE_HEADERS },
      );
    }
    const mission = await requestAiTeamMissionStop(
      auth.adminSupabase,
      auth.user.id,
      resolvedMission.id,
    );
    const stopRecorded =
      mission.status === "stopped" || Boolean(mission.stopRequestedAt);
    return NextResponse.json(
      {
        mission,
        stopRecorded: true,
        serverStopGuaranteed: false,
        message: stopRecorded
          ? "Stop request recorded. Already-running server work may take time to observe it."
          : "The mission was already terminal; client microphone, screen, request, and polling controls were stopped.",
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[admin/ai-team/missions] Stop request failed", error);
    return NextResponse.json(
      { error: "Unable to record the mission stop request." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
