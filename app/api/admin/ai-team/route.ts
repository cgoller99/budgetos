import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import {
  AI_TEAM_AGENTS,
  createAiTeamPlan,
  getAiTeamRuntimeInfo,
  getAiTeamSnapshot,
} from "@/lib/ai-team";

const PLAN_COOLDOWN_MS = 15_000;
const activePlanningUsers = new Set<string>();
const lastPlanStartedAt = new Map<string, number>();

function planBucketId(userId: string, now: number): string {
  const bucket = Math.floor(now / PLAN_COOLDOWN_MS);
  const hex = createHash("sha256")
    .update("ai-team-plan:" + userId + ":" + bucket)
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

async function claimPlanBucket(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  goal: string,
  now: number,
): Promise<boolean> {
  const { error } = await adminSupabase.from("admin_event_logs").insert({
    id: planBucketId(userId, now),
    event_type: "ai_team",
    message: "AI Team plan started",
    metadata: { goalLength: goal.length },
    user_id: userId,
  });

  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}

export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  try {
    const snapshot = await getAiTeamSnapshot(auth.adminSupabase);
    return NextResponse.json({
      agents: AI_TEAM_AGENTS,
      runtime: getAiTeamRuntimeInfo(),
      snapshot,
    });
  } catch (error) {
    console.error("[admin/ai-team] Snapshot failed", error);
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

  try {
    const claimed = await claimPlanBucket(auth.adminSupabase, userId, goal, now);
    if (!claimed) {
      return NextResponse.json(
        { error: "Please wait a few seconds before starting another plan." },
        { status: 429 },
      );
    }
  } catch (rateLimitError) {
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
    return NextResponse.json({
      plan,
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
  }
}
