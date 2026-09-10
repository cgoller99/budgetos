import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import {
  AI_TEAM_AGENTS,
  addAiTeamMissionVerification,
  appendAiTeamActivity,
  appendAiTeamMissionEvent,
  attachAiTeamActivityRun,
  attachAiTeamMissionRun,
  createAiTeamMission,
  createAiTeamPlan,
  finalizeAiTeamMission,
  getAiTeamRuntimeInfo,
  getAiTeamSnapshot,
  isAiTeamMissionStopRequested,
  isAiTeamOperationStopRequested,
  listAiTeamApprovalDecisions,
  listAiTeamPlaybooks,
  listRecentAiTeamMissions,
  listRecentAiTeamRuns,
  loadAiTeamMissionByOperation,
  requestAiTeamMissionStop,
  saveAiTeamRun,
  updateAiTeamMissionLifecycle,
} from "@/lib/ai-team";
import type {
  AiTeamAutonomyLevel,
  AiTeamMission,
  AiTeamRun,
} from "@/lib/ai-team/types";

const PLAN_COOLDOWN_MS = 15_000;
const PLAN_DAILY_LIMIT = 40;
const PLAN_LOCK_STALE_MS = 10 * 60_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const activePlanningUsers = new Set<string>();
const lastPlanStartedAt = new Map<string, number>();

function deterministicUuid(namespace: string, value: string): string {
  const hex = createHash("sha256")
    .update(namespace + ":" + value)
    .digest("hex")
    .slice(0, 32);

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "5" + hex.slice(13, 16),
    "a" + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}

function planLockId(userId: string): string {
  return deterministicUuid("ai-team-lock", userId);
}

function operationReservationId(userId: string, operationId: string): string {
  return deterministicUuid("ai-team-operation", userId + ":" + operationId);
}

async function hasDailyPlanCapacity(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  now: number,
): Promise<boolean> {
  return (await dailyPlanUsage(adminSupabase, userId, now)) < PLAN_DAILY_LIMIT;
}

async function dailyPlanUsage(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  now: number,
): Promise<number> {
  const dayStart = new Date(now);
  dayStart.setUTCHours(0, 0, 0, 0);

  const { count, error } = await adminSupabase
    .from("admin_event_logs")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "ai_team")
    .eq("message", "AI Team plan started")
    .eq("user_id", userId)
    .gte("created_at", dayStart.toISOString());

  if (error) throw error;
  return count ?? 0;
}

async function claimPlanLock(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  goal: string,
  now: number,
): Promise<string | null> {
  const id = planLockId(userId);
  // Opaque concurrency lease identifier, not an auth/session credential.
  const leaseId = randomUUID();
  const staleBefore = new Date(now - PLAN_LOCK_STALE_MS).toISOString();

  const { error: staleCleanupError } = await adminSupabase
    .from("admin_event_logs")
    .delete()
    .eq("id", id)
    .lt("created_at", staleBefore);

  if (staleCleanupError) throw staleCleanupError;

  const { error } = await adminSupabase.from("admin_event_logs").insert({
    id,
    event_type: "ai_team",
    message: "AI Team active lock",
    metadata: { goalLength: goal.length, leaseId },
    user_id: userId,
  });

  if (!error) return leaseId;
  if (error.code === "23505") return null;
  throw error;
}

async function recordPlanStart(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  goal: string,
): Promise<void> {
  const { error } = await adminSupabase.from("admin_event_logs").insert({
    event_type: "ai_team",
    message: "AI Team plan started",
    metadata: { goalLength: goal.length },
    user_id: userId,
  });

  if (error) throw error;
}

async function reserveOperationId(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  operationId: string,
): Promise<boolean> {
  const { error } = await adminSupabase.from("admin_event_logs").insert({
    id: operationReservationId(userId, operationId),
    event_type: "ai_team",
    message: "AI Team operation reserved",
    metadata: { operationId },
    user_id: userId,
  });

  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}

async function releaseOperationId(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  operationId: string,
): Promise<void> {
  const { error } = await adminSupabase
    .from("admin_event_logs")
    .delete()
    .eq("id", operationReservationId(userId, operationId))
    .eq("event_type", "ai_team")
    .eq("message", "AI Team operation reserved")
    .eq("user_id", userId)
    .contains("metadata", { operationId });

  if (error) throw error;
}

async function observeMissionStop(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  operationId: string,
  missionId: string,
  abortSignal: AbortSignal,
): Promise<AiTeamMission | null> {
  const [missionStopRequested, operationStopRequested] = await Promise.all([
    isAiTeamMissionStopRequested(adminSupabase, userId, missionId),
    isAiTeamOperationStopRequested(adminSupabase, userId, operationId),
  ]);
  if (
    !abortSignal.aborted &&
    !missionStopRequested &&
    !operationStopRequested
  ) {
    return null;
  }
  return requestAiTeamMissionStop(adminSupabase, userId, missionId);
}

function stopResponse(operationId: string, mission: AiTeamMission) {
  const stopped = mission.status === "stopped";
  return NextResponse.json(
    {
      error: stopped
        ? "Mission stop request observed."
        : `Mission was already ${mission.status} before the stop transition could win.`,
      message: stopped
        ? "The stop was persisted. External work already in flight may take time to observe cancellation."
        : "The persisted terminal mission state was not overwritten.",
      stopped,
      operationId,
      mission,
    },
    { status: 409 },
  );
}

async function releasePlanLock(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  leaseId: string,
): Promise<void> {
  const { error } = await adminSupabase
    .from("admin_event_logs")
    .delete()
    .eq("id", planLockId(userId))
    .contains("metadata", { leaseId });

  if (error) throw error;
}

export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  try {
    const [snapshot, recentRuns, playbooks, planningUsed, recentMissions] =
      await Promise.all([
      getAiTeamSnapshot(auth.adminSupabase),
      listRecentAiTeamRuns(auth.adminSupabase, auth.user.id),
      listAiTeamPlaybooks(auth.adminSupabase, auth.user.id),
      dailyPlanUsage(auth.adminSupabase, auth.user.id, Date.now()),
      listRecentAiTeamMissions(auth.adminSupabase, auth.user.id),
    ]);
    const approvalRuns = recentRuns.filter((run) =>
      run.tasks.some((task) => task.requiresApproval),
    );
    const approvalDecisions = await listAiTeamApprovalDecisions(
      auth.adminSupabase,
      [
        ...new Set(
          [...approvalRuns, ...recentRuns].flatMap((run) =>
            run.tasks
              .filter((task) => task.requiresApproval)
              .map((task) => task.id),
          ),
        ),
      ],
    );
    return NextResponse.json({
      agents: AI_TEAM_AGENTS,
      runtime: getAiTeamRuntimeInfo(),
      snapshot,
      recentRuns,
      approvalRuns,
      approvalDecisions,
      playbooks,
      recentMissions,
      planningUsage: { used: planningUsed, limit: PLAN_DAILY_LIMIT },
    });
  } catch (error) {
    console.error("[admin/ai-team] Load failed", error);
    return NextResponse.json(
      { error: "Unable to load AI Team." },
      { status: 500 },
    );
  }
}
export async function POST(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as
    | {
        goal?: unknown;
        operationId?: unknown;
        autonomyLevel?: unknown;
        context?: unknown;
      }
    | null;
  const goal = typeof body?.goal === "string" ? body.goal.trim() : "";
  const suppliedOperationId =
    typeof body?.operationId === "string" ? body.operationId.trim() : null;
  const autonomyLevel =
    typeof body?.autonomyLevel === "string"
      ? body.autonomyLevel
      : "assist";
  const allowedAutonomy = new Set<AiTeamAutonomyLevel>([
    "observe",
    "assist",
    "act",
    "autopilot",
  ]);

  if (goal.length < 3 || goal.length > 1000) {
    return NextResponse.json(
      { error: "Goal must be between 3 and 1000 characters." },
      { status: 400 },
    );
  }

  if (
    body?.operationId !== undefined &&
    (!suppliedOperationId || !UUID_PATTERN.test(suppliedOperationId))
  ) {
    return NextResponse.json(
      { error: "operationId must be a valid UUID." },
      { status: 400 },
    );
  }
  if (!allowedAutonomy.has(autonomyLevel as AiTeamAutonomyLevel)) {
    return NextResponse.json(
      { error: "Invalid autonomy level." },
      { status: 400 },
    );
  }

  const operationId = suppliedOperationId ?? randomUUID();
  const userId = auth.user.id;

  const now = Date.now();
  const lastStartedAt = lastPlanStartedAt.get(userId) ?? 0;

  if (activePlanningUsers.has(userId)) {
    return NextResponse.json(
      { error: "An AI Team plan is already running." },
      { status: 429 },
    );
  }

  if (now - lastStartedAt < PLAN_COOLDOWN_MS) {
    return NextResponse.json(
      { error: "Please wait a few seconds before starting another plan." },
      { status: 429 },
    );
  }

  let distributedLeaseId: string | null = null;
  let mission: AiTeamMission | null = null;
  let operationReserved = false;

  try {
    if (!(await hasDailyPlanCapacity(auth.adminSupabase, userId, now))) {
      return NextResponse.json(
        { error: "Daily AI Team planning limit reached. Try again tomorrow." },
        { status: 429 },
      );
    }

    distributedLeaseId = await claimPlanLock(
      auth.adminSupabase,
      userId,
      goal,
      now,
    );
    if (!distributedLeaseId) {
      return NextResponse.json(
        { error: "An AI Team plan is already running." },
        { status: 429 },
      );
    }

    try {
      operationReserved = await reserveOperationId(
        auth.adminSupabase,
        userId,
        operationId,
      );
    } catch (operationReservationError) {
      console.error(
        "[admin/ai-team] Operation reservation failed",
        operationReservationError,
      );
      throw new Error("AI Team operation guard is temporarily unavailable.", {
        cause: operationReservationError,
      });
    }
    if (!operationReserved) {
      await releasePlanLock(
        auth.adminSupabase,
        userId,
        distributedLeaseId,
      ).catch((releaseError) =>
        console.error("[admin/ai-team] Lock cleanup failed", releaseError),
      );
      distributedLeaseId = null;
      return NextResponse.json(
        { error: "operationId has already been used.", operationId },
        { status: 409 },
      );
    }

    if (
      request.signal.aborted ||
      (await isAiTeamOperationStopRequested(
        auth.adminSupabase,
        userId,
        operationId,
      ))
    ) {
      await releasePlanLock(
        auth.adminSupabase,
        userId,
        distributedLeaseId,
      ).catch((releaseError) =>
        console.error("[admin/ai-team] Lock cleanup failed", releaseError),
      );
      distributedLeaseId = null;
      return NextResponse.json(
        {
          error: "Mission stopped before persistent mission creation.",
          message:
            "The stop request was persisted before the mission record was created, so planning did not start.",
          stopped: true,
          operationId,
          mission: null,
        },
        { status: 409 },
      );
    }

    const contextInput =
      body?.context &&
      typeof body.context === "object" &&
      !Array.isArray(body.context)
        ? (body.context as Record<string, unknown>)
        : {};
    const missionContext = {
      screenSharingActive: contextInput.screenSharingActive === true,
      displayWidth:
        typeof contextInput.displayWidth === "number" &&
        Number.isFinite(contextInput.displayWidth)
          ? Math.max(0, Math.round(contextInput.displayWidth))
          : 0,
      displayHeight:
        typeof contextInput.displayHeight === "number" &&
        Number.isFinite(contextInput.displayHeight)
          ? Math.max(0, Math.round(contextInput.displayHeight))
          : 0,
      commandSource:
        contextInput.commandSource === "voice" ? "voice" : "text",
    };
    mission = await createAiTeamMission(auth.adminSupabase, {
      createdBy: userId,
      operationId,
      command: goal,
      autonomyLevel: autonomyLevel as AiTeamAutonomyLevel,
      context: missionContext,
    });
    const stoppedMission = await observeMissionStop(
      auth.adminSupabase,
      userId,
      operationId,
      mission.id,
      request.signal,
    );
    if (stoppedMission) {
      await releasePlanLock(
        auth.adminSupabase,
        userId,
        distributedLeaseId,
      ).catch((releaseError) =>
        console.error("[admin/ai-team] Lock cleanup failed", releaseError),
      );
      distributedLeaseId = null;
      return stopResponse(operationId, stoppedMission);
    }
    await recordPlanStart(auth.adminSupabase, userId, goal);
    mission = await updateAiTeamMissionLifecycle(
      auth.adminSupabase,
      userId,
      mission.id,
      "planning",
    );
    if (mission.status === "stopped") {
      await releasePlanLock(
        auth.adminSupabase,
        userId,
        distributedLeaseId,
      ).catch((releaseError) =>
        console.error("[admin/ai-team] Lock cleanup failed", releaseError),
      );
      distributedLeaseId = null;
      return stopResponse(operationId, mission);
    }
  } catch (rateLimitError) {
    if (operationReserved && !mission) {
      try {
        mission = await loadAiTeamMissionByOperation(
          auth.adminSupabase,
          userId,
          operationId,
        );
        if (!mission) {
          await releaseOperationId(
            auth.adminSupabase,
            userId,
            operationId,
          );
          operationReserved = false;
        }
      } catch (reservationReleaseError) {
        console.error(
          "[admin/ai-team] Operation reservation cleanup failed",
          reservationReleaseError,
        );
      }
    }
    if (distributedLeaseId) {
      await releasePlanLock(
        auth.adminSupabase,
        userId,
        distributedLeaseId,
      ).catch((releaseError) =>
        console.error("[admin/ai-team] Lock cleanup failed", releaseError),
      );
    }

    console.error("[admin/ai-team] Durable rate-limit guard failed", rateLimitError);
    if (mission) {
      const stoppedMission = await observeMissionStop(
        auth.adminSupabase,
        userId,
        operationId,
        mission.id,
        request.signal,
      ).catch(() => null);
      if (stoppedMission) return stopResponse(operationId, stoppedMission);
      await appendAiTeamMissionEvent(auth.adminSupabase, {
        missionId: mission.id,
        createdBy: userId,
        phase: "initialization",
        eventType: "failed",
        status: "failed",
        summary: "Mission initialization failed",
        detail: "The mission could not safely enter the planning lifecycle.",
        ordinal: 1,
      }).catch(() => undefined);
      await finalizeAiTeamMission(
        auth.adminSupabase,
        userId,
        mission.id,
        "failed",
        null,
      ).catch(() => undefined);
    }
    return NextResponse.json(
      {
        error: mission
          ? "AI Team mission initialization failed."
          : "AI Team guard is temporarily unavailable.",
      },
      { status: 503 },
    );
  }

  activePlanningUsers.add(userId);
  lastPlanStartedAt.set(userId, now);

  let ordinal = 0;
  let missionOrdinal = 1;
  let persistedRunId: string | undefined;
  let persistedRun: AiTeamRun | null = null;
  let missionTraceHealthy = true;
  const recordActivity = async (event: {
    agentId?: (typeof AI_TEAM_AGENTS)[number]["id"];
    phase: string;
    status: "pending" | "running" | "completed" | "warning" | "failed";
    label: string;
    detail?: string;
  }): Promise<void> => {
    const eventOrdinal = ordinal++;
    const activityWrite = appendAiTeamActivity(auth.adminSupabase, {
        operationId,
        createdBy: userId,
        runId: persistedRunId,
        ordinal: eventOrdinal,
        ...event,
      });
    const missionWrite = appendAiTeamMissionEvent(auth.adminSupabase, {
      missionId: mission!.id,
      createdBy: userId,
      phase: event.phase,
      eventType: event.phase,
      agentId: event.agentId,
      status: event.status,
      summary: event.label,
      detail: event.detail,
      ordinal: missionOrdinal++,
    });
    const [activityResult, missionResult] = await Promise.allSettled([
      activityWrite,
      missionWrite,
    ]);
    if (activityResult.status === "rejected") {
      console.error("[admin/ai-team] Activity write failed", {
        operationId,
        ordinal: eventOrdinal,
        phase: event.phase,
        error: activityResult.reason,
      });
    }
    if (missionResult.status === "rejected") {
      missionTraceHealthy = false;
      console.error("[admin/ai-team] Mission event write failed", {
        operationId,
        missionId: mission!.id,
        phase: event.phase,
        error: missionResult.reason,
      });
    }
  };

  try {
    const stoppedBeforeEvidence = await observeMissionStop(
      auth.adminSupabase,
      userId,
      operationId,
      mission!.id,
      request.signal,
    );
    if (stoppedBeforeEvidence) {
      return stopResponse(operationId, stoppedBeforeEvidence);
    }
    await recordActivity({
      phase: "initializing",
      status: "running",
      label: "Command accepted",
      detail: "Mission Control is initializing a safe operational plan.",
    });
    await recordActivity({
      phase: "evidence",
      status: "running",
      label: "Collecting evidence",
      detail: "Loading current operating, revenue, product, Plaid, and health signals.",
    });
    const snapshot = await getAiTeamSnapshot(auth.adminSupabase);
    await recordActivity({
      phase: "evidence",
      status: "completed",
      label: "Evidence collection completed",
      detail: `${snapshot.unavailableSources.length} evidence source${
        snapshot.unavailableSources.length === 1 ? "" : "s"
      } unavailable.`,
    });
    const stoppedAfterEvidence = await observeMissionStop(
      auth.adminSupabase,
      userId,
      operationId,
      mission!.id,
      request.signal,
    );
    if (stoppedAfterEvidence) {
      return stopResponse(operationId, stoppedAfterEvidence);
    }
    const plan = await createAiTeamPlan(
      goal,
      snapshot,
      recordActivity,
      request.signal,
    );
    let run;
    const stoppedAfterPlanning = await observeMissionStop(
      auth.adminSupabase,
      userId,
      operationId,
      mission!.id,
      request.signal,
    );
    if (stoppedAfterPlanning) {
      return stopResponse(operationId, stoppedAfterPlanning);
    }

    const runningMission = await updateAiTeamMissionLifecycle(
      auth.adminSupabase,
      userId,
      mission!.id,
      "running",
    );
    if (runningMission.status === "stopped") {
      return stopResponse(operationId, runningMission);
    }

    await recordActivity({
      phase: "persistence",
      status: "running",
      label: "Saving command result",
      detail: "Persisting the plan and its approval-aware tasks.",
    });
    try {
      run = await saveAiTeamRun(
        auth.adminSupabase,
        auth.user.id,
        plan,
        snapshot,
      );
    } catch (persistenceError) {
      console.error("[admin/ai-team] Plan persistence failed", persistenceError);
      await recordActivity({
        phase: "persistence",
        status: "failed",
        label: "Plan persistence failed",
        detail: "The generated plan could not be safely saved.",
      }).catch((activityError) =>
        console.error("[admin/ai-team] Failure activity write failed", activityError),
      );
      await recordActivity({
        phase: "operation",
        status: "failed",
        label: "Command failed",
        detail: "Mission Control stopped because the plan could not be persisted.",
      }).catch((activityError) =>
        console.error("[admin/ai-team] Failure activity write failed", activityError),
      );
      await addAiTeamMissionVerification(auth.adminSupabase, {
        missionId: mission!.id,
        createdBy: userId,
        checkType: "run_persisted",
        status: "failed",
        summary: "The generated run was not persisted.",
      }).catch((verificationError) =>
        console.error("[admin/ai-team] Failure verification write failed", verificationError),
      );
      const failedMission = await finalizeAiTeamMission(
        auth.adminSupabase,
        userId,
        mission!.id,
        "failed",
        null,
      ).catch(() => null);
      if (failedMission?.status === "stopped") {
        return stopResponse(operationId, failedMission);
      }
      return NextResponse.json(
        {
          error: "The plan was generated but could not be saved. Please try again.",
          operationId,
          mission: failedMission,
        },
        { status: 500 },
      );
    }

    persistedRun = run;
    persistedRunId = run.id;
    const activityAttached = await attachAiTeamActivityRun(
      auth.adminSupabase,
      userId,
      operationId,
      run.id,
    ).then(
      () => true,
      (activityAttachError) => {
        console.error(
        "[admin/ai-team] Activity run attachment failed",
        activityAttachError,
        );
        return false;
      },
    );
    await attachAiTeamMissionRun(
      auth.adminSupabase,
      userId,
      mission!.id,
      run.id,
    );
    const stoppedAfterPersistence = await observeMissionStop(
      auth.adminSupabase,
      userId,
      operationId,
      mission!.id,
      request.signal,
    );
    if (stoppedAfterPersistence) {
      return stopResponse(operationId, stoppedAfterPersistence);
    }
    await recordActivity({
      phase: "persistence",
      status: "completed",
      label: "Command result saved",
      detail: "The plan, tasks, and operational trace are linked to the run.",
    });
    const verifyingMission = await updateAiTeamMissionLifecycle(
      auth.adminSupabase,
      userId,
      mission!.id,
      "verifying",
    );
    if (verifyingMission.status === "stopped") {
      return stopResponse(operationId, verifyingMission);
    }
    await recordActivity({
      phase: "verification",
      status: "running",
      label: "Verifying mission result",
      detail: "Checking persistence, trace linkage, and approval representation.",
    });
    const approvalRepresented = run.tasks.every(
      (task) =>
        !task.requiresApproval ||
        (task.status === "needs_approval" && Boolean(task.approvalReason)),
    );
    const checks = [
      {
        checkType: "run_persisted",
        passed: Boolean(run.id),
        summary: "Mission run persisted.",
        evidence: { runId: run.id },
      },
      {
        checkType: "tasks_persisted",
        passed: run.tasks.length > 0,
        summary: `${run.tasks.length} mission task${run.tasks.length === 1 ? "" : "s"} persisted.`,
        evidence: { taskCount: run.tasks.length },
      },
      {
        checkType: "operational_trace_linked",
        passed: activityAttached && missionTraceHealthy,
        summary:
          activityAttached && missionTraceHealthy
            ? "Operational activity and mission events are linked."
            : "One or more operational trace records could not be linked.",
        evidence: { activityAttached, missionTraceHealthy },
      },
      {
        checkType: "approval_requirements_represented",
        passed: approvalRepresented,
        summary: approvalRepresented
          ? "All approval requirements are represented on persisted tasks."
          : "An approval requirement was not represented safely.",
        evidence: {
          approvalTaskCount: run.tasks.filter((task) => task.requiresApproval)
            .length,
        },
      },
    ];
    await Promise.all(
      checks.map((check) =>
        addAiTeamMissionVerification(auth.adminSupabase, {
          missionId: mission!.id,
          createdBy: userId,
          checkType: check.checkType,
          status: check.passed ? "passed" : "failed",
          summary: check.summary,
          evidence: check.evidence,
        }),
      ),
    );
    const verificationPassed = checks.every((check) => check.passed);
    await recordActivity({
      phase: "verification",
      status: verificationPassed ? "completed" : "failed",
      label: verificationPassed
        ? "Mission verification passed"
        : "Mission verification found a problem",
      detail: verificationPassed
        ? "The planning result and its operational trace were verified."
        : "The mission report records the checks that did not pass.",
    });
    await recordActivity({
      phase: "operation",
      status: verificationPassed ? "completed" : "warning",
      label: verificationPassed ? "Command completed" : "Command partially completed",
      detail:
        "The final plan is ready for founder review. No changes were made.",
    });
    const stoppedAfterVerification = await observeMissionStop(
      auth.adminSupabase,
      userId,
      operationId,
      mission!.id,
      request.signal,
    );
    if (stoppedAfterVerification) {
      return stopResponse(operationId, stoppedAfterVerification);
    }
    const completedMission = await finalizeAiTeamMission(
      auth.adminSupabase,
      userId,
      mission!.id,
      verificationPassed ? "completed" : "partial",
      run,
    );
    if (completedMission.status === "stopped") {
      return stopResponse(operationId, completedMission);
    }

    return NextResponse.json({
      operationId,
      plan,
      run,
      mission: completedMission,
      runtime: {
        ...getAiTeamRuntimeInfo(),
        mode: plan.source,
      },
      snapshot,
    });
  } catch (error) {
    const stoppedMission = mission
      ? await observeMissionStop(
          auth.adminSupabase,
          userId,
          operationId,
          mission!.id,
          request.signal,
        ).catch(() => null)
      : null;

    if (stoppedMission && mission) {
      await recordActivity({
        phase: "control",
        status: "warning",
        label: "Mission stop observed",
        detail:
          "Mission Control stopped the active request before continuing to later stages.",
      }).catch((activityError) =>
        console.error("[admin/ai-team] Stop activity write failed", activityError),
      );
      return stopResponse(operationId, stoppedMission);
    }

    console.error("[admin/ai-team] Planning failed", error);
    await recordActivity({
      phase: "operation",
      status: "failed",
      label: "Command failed",
      detail: "Mission Control stopped after an operational error.",
    }).catch((activityError) =>
      console.error("[admin/ai-team] Failure activity write failed", activityError),
    );
    const failedMission = mission
      ? await finalizeAiTeamMission(
          auth.adminSupabase,
          userId,
          mission.id,
          persistedRun ? "partial" : "failed",
          persistedRun,
        ).catch((finalizeError) => {
          console.error("[admin/ai-team] Mission failure finalization failed", finalizeError);
          return null;
        })
      : null;
    if (failedMission?.status === "stopped") {
      return stopResponse(operationId, failedMission);
    }
    return NextResponse.json(
      {
        error: "Unable to create AI Team plan.",
        operationId,
        mission: failedMission,
      },
      { status: 500 },
    );
  } finally {
    activePlanningUsers.delete(userId);

    if (distributedLeaseId) {
      await releasePlanLock(
        auth.adminSupabase,
        userId,
        distributedLeaseId,
      ).catch((releaseError) =>
        console.error("[admin/ai-team] Lock release failed", releaseError),
      );
    }
  }
}
