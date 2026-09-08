import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import {
  AI_TEAM_AGENTS,
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
const activePlanningUsers = new Set<string>();
const lastPlanStartedAt = new Map<string, number>();

function planLockId(userId: string): string {
  const hex = createHash("sha256")
    .update("ai-team-lock:" + userId)
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
      listRecentAiTeamRuns(auth.adminSupabase),
      listAiTeamApprovalRuns(auth.adminSupabase),
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
    | { goal?: unknown }
    | null;
  const goal = typeof body?.goal === "string" ? body.goal.trim() : "";

  if (goal.length < 3 || goal.length > 1000) {
    return NextResponse.json(
      { error: "Goal must be between 3 and 1000 characters." },
      { status: 400 },
    );
  }

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

  try {
    const snapshot = await getAiTeamSnapshot(auth.adminSupabase);
    const plan = await createAiTeamPlan(goal, snapshot);
    let run;

    try {
      run = await saveAiTeamRun(
        auth.adminSupabase,
        auth.user.id,
        plan,
        snapshot,
      );
    } catch (persistenceError) {
      console.error("[admin/ai-team] Plan persistence failed", persistenceError);
      return NextResponse.json(
        { error: "The plan was generated but could not be saved. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      plan,
      run,
      runtime: getAiTeamRuntimeInfo(),
      snapshot,
    });
  } catch (error) {
    console.error("[admin/ai-team] Planning failed", error);
    return NextResponse.json(
      { error: "Unable to create AI Team plan." },
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
