import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import {
  AI_TEAM_AGENTS,
  appendAiTeamActivity,
  attachAiTeamActivityRun,
  createAiTeamPlan,
  getAiTeamRuntimeInfo,
  getAiTeamSnapshot,
  listAiTeamApprovalDecisions,
  listAiTeamApprovalRuns,
  listAiTeamPlaybooks,
  listRecentAiTeamRuns,
  saveAiTeamRun,
} from "@/lib/ai-team";

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
  const lockToken = randomUUID();
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
    metadata: { goalLength: goal.length, lockToken },
    user_id: userId,
  });

  if (!error) return lockToken;
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

async function releasePlanLock(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  lockToken: string,
): Promise<void> {
  const { error } = await adminSupabase
    .from("admin_event_logs")
    .delete()
    .eq("id", planLockId(userId))
    .contains("metadata", { lockToken });

  if (error) throw error;
}

export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  try {
    const [snapshot, recentRuns, approvalRuns, playbooks, planningUsed] =
      await Promise.all([
      getAiTeamSnapshot(auth.adminSupabase),
      listRecentAiTeamRuns(auth.adminSupabase, auth.user.id),
      listAiTeamApprovalRuns(auth.adminSupabase, auth.user.id),
      listAiTeamPlaybooks(auth.adminSupabase, auth.user.id),
      dailyPlanUsage(auth.adminSupabase, auth.user.id, Date.now()),
    ]);
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
    | { goal?: unknown; operationId?: unknown }
    | null;
  const goal = typeof body?.goal === "string" ? body.goal.trim() : "";
  const suppliedOperationId =
    typeof body?.operationId === "string" ? body.operationId.trim() : null;

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

  const operationId = suppliedOperationId ?? randomUUID();
  const userId = auth.user.id;

  try {
    const reserved = await reserveOperationId(
      auth.adminSupabase,
      userId,
      operationId,
    );
    if (!reserved) {
      return NextResponse.json(
        { error: "operationId has already been used.", operationId },
        { status: 409 },
      );
    }
  } catch (operationReservationError) {
    console.error(
      "[admin/ai-team] Operation reservation failed",
      operationReservationError,
    );
    return NextResponse.json(
      { error: "AI Team operation guard is temporarily unavailable." },
      { status: 503 },
    );
  }

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

  let distributedLockToken: string | null = null;

  try {
    if (!(await hasDailyPlanCapacity(auth.adminSupabase, userId, now))) {
      return NextResponse.json(
        { error: "Daily AI Team planning limit reached. Try again tomorrow." },
        { status: 429 },
      );
    }

    distributedLockToken = await claimPlanLock(
      auth.adminSupabase,
      userId,
      goal,
      now,
    );
    if (!distributedLockToken) {
      return NextResponse.json(
        { error: "An AI Team plan is already running." },
        { status: 429 },
      );
    }

    await recordPlanStart(auth.adminSupabase, userId, goal);
  } catch (rateLimitError) {
    if (distributedLockToken) {
      await releasePlanLock(
        auth.adminSupabase,
        userId,
        distributedLockToken,
      ).catch((releaseError) =>
        console.error("[admin/ai-team] Lock cleanup failed", releaseError),
      );
    }

    console.error("[admin/ai-team] Durable rate-limit guard failed", rateLimitError);
    return NextResponse.json(
      { error: "AI Team guard is temporarily unavailable." },
      { status: 503 },
    );
  }

  activePlanningUsers.add(userId);
  lastPlanStartedAt.set(userId, now);

  let ordinal = 0;
  let persistedRunId: string | undefined;
  const recordActivity = async (event: {
    agentId?: (typeof AI_TEAM_AGENTS)[number]["id"];
    phase: string;
    status: "pending" | "running" | "completed" | "warning" | "failed";
    label: string;
    detail?: string;
  }): Promise<void> => {
    const eventOrdinal = ordinal++;
    try {
      await appendAiTeamActivity(auth.adminSupabase, {
        operationId,
        createdBy: userId,
        runId: persistedRunId,
        ordinal: eventOrdinal,
        ...event,
      });
    } catch (activityError) {
      console.error("[admin/ai-team] Activity write failed", {
        operationId,
        ordinal: eventOrdinal,
        phase: event.phase,
        error: activityError,
      });
    }
  };

  try {
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
    const plan = await createAiTeamPlan(goal, snapshot, recordActivity);
    let run;

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
      return NextResponse.json(
        {
          error: "The plan was generated but could not be saved. Please try again.",
          operationId,
        },
        { status: 500 },
      );
    }

    persistedRunId = run.id;
    await attachAiTeamActivityRun(
      auth.adminSupabase,
      userId,
      operationId,
      run.id,
    ).catch((activityAttachError) =>
      console.error(
        "[admin/ai-team] Activity run attachment failed",
        activityAttachError,
      ),
    );
    await recordActivity({
      phase: "persistence",
      status: "completed",
      label: "Command result saved",
      detail: "The plan, tasks, and operational trace are linked to the run.",
    });
    await recordActivity({
      phase: "operation",
      status: "completed",
      label: "Command completed",
      detail: "The final plan is ready for founder review.",
    });

    return NextResponse.json({
      operationId,
      plan,
      run,
      runtime: getAiTeamRuntimeInfo(),
      snapshot,
    });
  } catch (error) {
    console.error("[admin/ai-team] Planning failed", error);
    await recordActivity({
      phase: "operation",
      status: "failed",
      label: "Command failed",
      detail: "Mission Control stopped after an operational error.",
    }).catch((activityError) =>
      console.error("[admin/ai-team] Failure activity write failed", activityError),
    );
    return NextResponse.json(
      { error: "Unable to create AI Team plan.", operationId },
      { status: 500 },
    );
  } finally {
    activePlanningUsers.delete(userId);

    if (distributedLockToken) {
      await releasePlanLock(
        auth.adminSupabase,
        userId,
        distributedLockToken,
      ).catch((releaseError) =>
        console.error("[admin/ai-team] Lock release failed", releaseError),
      );
    }
  }
}
