import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { logAdminEvent } from "@/lib/admin/eventLog";
import {
  AiTeamActionStoppedError,
  addAiTeamMissionChange,
  addAiTeamMissionVerification,
  appendAiTeamMissionEvent,
  autonomyAllowsAiTeamAction,
  createAiTeamMission,
  detectAiTeamActionCommand,
  executeAiTeamRegisteredAction,
  finalizeAiTeamMission,
  getAiTeamActionDefinition,
  isAiTeamMissionStopRequested,
  isAiTeamOperationStopRequested,
  loadAiTeamMissionByOperation,
  requestAiTeamMissionStop,
  updateAiTeamMissionLifecycle,
} from "@/lib/ai-team";
import type { AiTeamAutonomyLevel, AiTeamMission } from "@/lib/ai-team/types";

export const runtime = "nodejs";
const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AUTONOMY = new Set<AiTeamAutonomyLevel>(["observe", "assist", "act", "autopilot"]);
function invalid(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE_HEADERS });
}

function stoppedResponse(operationId: string, mission: AiTeamMission | null) {
  return NextResponse.json(
    {
      operationId,
      mission,
      stopped: true,
      error: "Action stopped.",
    },
    { status: 409, headers: NO_STORE_HEADERS },
  );
}

export async function POST(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as
    | { goal?: unknown; operationId?: unknown; autonomyLevel?: unknown; context?: unknown }
    | null;
  const goal = typeof body?.goal === "string" ? body.goal.replace(/\s+/g, " ").trim() : "";
  const operationId = typeof body?.operationId === "string" ? body.operationId.trim() : "";
  const autonomyLevel = typeof body?.autonomyLevel === "string" ? body.autonomyLevel : "assist";
  if (
    goal.length < 3 ||
    goal.length > 1000 ||
    !UUID_PATTERN.test(operationId) ||
    !AUTONOMY.has(autonomyLevel as AiTeamAutonomyLevel)
  ) {
    return invalid("Action request is invalid.");
  }

  const actionKey = detectAiTeamActionCommand(goal);
  if (!actionKey) {
    return invalid("This command is not a registered Buxme action.", 404);
  }
  const action = getAiTeamActionDefinition(actionKey);
  if (!autonomyAllowsAiTeamAction(autonomyLevel as AiTeamAutonomyLevel, action)) {
    return invalid(
      action.mutates
        ? "This registered write requires Act or Autopilot autonomy."
        : "The selected autonomy level cannot run this action.",
      409,
    );
  }

  const userId = auth.user.id;
  let mission: AiTeamMission | null = null;
  let ordinal = 1;
  try {
    if (
      request.signal.aborted ||
      (await isAiTeamOperationStopRequested(auth.adminSupabase, userId, operationId))
    ) {
      return stoppedResponse(operationId, null);
    }

    const existing = await loadAiTeamMissionByOperation(
      auth.adminSupabase,
      userId,
      operationId,
    );
    if (existing) {
      return NextResponse.json(
        { error: "operationId has already been used.", operationId, mission: existing },
        { status: 409, headers: NO_STORE_HEADERS },
      );
    }

    const context =
      body?.context && typeof body.context === "object" && !Array.isArray(body.context)
        ? (body.context as Record<string, unknown>)
        : {};
    mission = await createAiTeamMission(auth.adminSupabase, {
      createdBy: userId,
      operationId,
      command: goal,
      autonomyLevel: autonomyLevel as AiTeamAutonomyLevel,
      context: {
        actionBridge: true,
        actionKey,
        commandSource: context.commandSource === "voice" ? "voice" : "text",
      },
    });

    if (
      request.signal.aborted ||
      (await isAiTeamOperationStopRequested(auth.adminSupabase, userId, operationId))
    ) {
      mission = await requestAiTeamMissionStop(auth.adminSupabase, userId, mission.id);
      return stoppedResponse(operationId, mission);
    }

    mission = await updateAiTeamMissionLifecycle(
      auth.adminSupabase,
      userId,
      mission.id,
      "running",
    );
    await appendAiTeamMissionEvent(auth.adminSupabase, {
      missionId: mission.id,
      createdBy: userId,
      phase: "action",
      eventType: "action_started",
      toolName: action.key,
      status: "running",
      summary: `${action.label} started`,
      detail: "The command matched a registered server-side Buxme action.",
      ordinal: ordinal++,
    });
    const assertContinue = async () => {
      if (
        request.signal.aborted ||
        (await isAiTeamOperationStopRequested(auth.adminSupabase, userId, operationId)) ||
        (await isAiTeamMissionStopRequested(auth.adminSupabase, userId, mission!.id))
      ) {
        throw new AiTeamActionStoppedError();
      }
    };

    const execution = await executeAiTeamRegisteredAction(
      auth.adminSupabase,
      userId,
      actionKey,
      assertContinue,
    );

    for (const finding of execution.findings.slice(0, 8)) {
      await appendAiTeamMissionEvent(auth.adminSupabase, {
        missionId: mission.id,
        createdBy: userId,
        phase: "evidence",
        eventType: "finding",
        toolName: action.key,
        status: "completed",
        summary: "Action finding",
        detail: finding,
        ordinal: ordinal++,
      });
    }
    if (
      execution.changed &&
      execution.targetType &&
      execution.targetRef &&
      execution.changeAction
    ) {
      await addAiTeamMissionChange(auth.adminSupabase, {
        missionId: mission.id,
        createdBy: userId,
        targetType: execution.targetType,
        targetRef: execution.targetRef,
        action: execution.changeAction,
        beforeSnapshot: execution.beforeSnapshot,
        afterSnapshot: execution.afterSnapshot,
        summary: execution.summary,
        verified: execution.verificationPassed,
      });
    }

    mission = await updateAiTeamMissionLifecycle(
      auth.adminSupabase,
      userId,
      mission.id,
      "verifying",
    );
    await addAiTeamMissionVerification(auth.adminSupabase, {
      missionId: mission.id,
      createdBy: userId,
      checkType: `action:${action.key}`,
      status: execution.verificationPassed ? "passed" : "failed",
      summary: execution.verificationSummary,
      evidence: execution.verificationEvidence,
    });
    await appendAiTeamMissionEvent(auth.adminSupabase, {
      missionId: mission.id,
      createdBy: userId,
      phase: "verification",
      eventType: "verification",
      toolName: action.key,
      status: execution.verificationPassed ? "completed" : "failed",
      summary: execution.verificationPassed ? "Action verified" : "Action verification failed",
      detail: execution.verificationSummary,
      ordinal: ordinal++,
    });

    const stoppedAfterExecution =
      request.signal.aborted ||
      (await isAiTeamOperationStopRequested(auth.adminSupabase, userId, operationId)) ||
      (await isAiTeamMissionStopRequested(auth.adminSupabase, userId, mission.id));
    if (stoppedAfterExecution) {
      mission = await requestAiTeamMissionStop(auth.adminSupabase, userId, mission.id);
      return stoppedResponse(operationId, mission);
    }

    await appendAiTeamMissionEvent(auth.adminSupabase, {
      missionId: mission.id,
      createdBy: userId,
      phase: "operation",
      eventType: "action_completed",
      toolName: action.key,
      status: execution.verificationPassed ? "completed" : "failed",
      summary: execution.summary,
      ordinal: ordinal++,
    });
    const requestedStatus = execution.verificationPassed
      ? "completed"
      : execution.changed
        ? "partial"
        : "failed";
    mission = await finalizeAiTeamMission(
      auth.adminSupabase,
      userId,
      mission.id,
      requestedStatus,
      null,
    );

    await logAdminEvent(auth.adminSupabase, {
      eventType: "ai_team",
      message: "AI Team registered action finished",
      metadata: {
        missionId: mission.id,
        operationId,
        actionKey,
        status: mission.status,
        changed: execution.changed,
        verified: execution.verificationPassed,
      },
      userId,
    });

    return NextResponse.json(
      {
        operationId,
        action,
        execution,
        mission,
        snapshot: execution.refreshedSnapshot ?? null,
        founderBrief: execution.founderBrief ?? null,
      },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    const stopped =
      error instanceof AiTeamActionStoppedError ||
      request.signal.aborted ||
      (await isAiTeamOperationStopRequested(auth.adminSupabase, userId, operationId).catch(() => false));

    if (stopped && mission) {
      const stoppedMission = await requestAiTeamMissionStop(
        auth.adminSupabase,
        userId,
        mission.id,
      ).catch(() => mission);
      return stoppedResponse(operationId, stoppedMission);
    }
    if (!mission) {
      const duplicate = await loadAiTeamMissionByOperation(
        auth.adminSupabase,
        userId,
        operationId,
      ).catch(() => null);
      if (duplicate) {
        return NextResponse.json(
          { error: "operationId has already been used.", operationId, mission: duplicate },
          { status: 409, headers: NO_STORE_HEADERS },
        );
      }
    }
    if (mission) {
      await appendAiTeamMissionEvent(auth.adminSupabase, {
        missionId: mission.id,
        createdBy: userId,
        phase: "action",
        eventType: "action_failed",
        toolName: action.key,
        status: "failed",
        summary: `${action.label} failed`,
        detail: "The registered action could not complete safely.",
        ordinal: ordinal++,
      }).catch(() => undefined);
      await addAiTeamMissionVerification(auth.adminSupabase, {
        missionId: mission.id,
        createdBy: userId,
        checkType: `action:${action.key}`,
        status: "failed",
        summary: "The registered action did not reach a verified completion state.",
      }).catch(() => undefined);
      mission = await finalizeAiTeamMission(
        auth.adminSupabase,
        userId,
        mission.id,
        "failed",
        null,
      ).catch(() => mission);
    }

    console.error("[admin/ai-team/actions] Registered action failed", {
      actionKey,
      missionId: mission?.id ?? null,
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      {
        error: "Registered Buxme action failed.",
        operationId,
        mission,
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
