import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { logAdminEvent } from "@/lib/admin/eventLog";
import {
  getAiTeamCustomerVoice,
  getAiTeamProductAnalytics,
  getAiTeamRevenueIntelligence,
  getAiTeamSnapshot,
  getLatestAiTeamFounderBrief,
  listAiTeamApprovalDecisions,
  listAiTeamApprovalRuns,
  listAiTeamExecutionPackets,
  listRecentAiTeamRuns,
  saveAiTeamFounderBrief,
} from "@/lib/ai-team";

export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  try {
    return NextResponse.json({
      brief: await getLatestAiTeamFounderBrief(auth.adminSupabase),
    });
  } catch (error) {
    console.error("[admin/ai-team/brief] Load failed", error);
    return NextResponse.json(
      { error: "Founder brief persistence is not ready." },
      { status: 503 },
    );
  }
}

export async function POST() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  try {
    const [snapshot, product, revenue, voice, runs, approvalRuns, packets] =
      await Promise.all([
        getAiTeamSnapshot(auth.adminSupabase),
        getAiTeamProductAnalytics(auth.adminSupabase),
        getAiTeamRevenueIntelligence(auth.adminSupabase),
        getAiTeamCustomerVoice(auth.adminSupabase),
        listRecentAiTeamRuns(auth.adminSupabase),
        listAiTeamApprovalRuns(auth.adminSupabase),
        listAiTeamExecutionPackets(auth.adminSupabase),
      ]);
    const decisionTaskIds = [
      ...new Set(
        [...runs, ...approvalRuns].flatMap((run) =>
          run.tasks
            .filter((task) => task.requiresApproval)
            .map((task) => task.id),
        ),
      ),
    ];
    const decisions = await listAiTeamApprovalDecisions(
      auth.adminSupabase,
      decisionTaskIds,
    );
    const brief = await saveAiTeamFounderBrief(
      auth.adminSupabase,
      auth.user.id,
      {
        snapshot,
        product,
        revenue,
        voice,
        runs,
        approvalRuns,
        decisions,
        packets,
      },
    );
    await logAdminEvent(auth.adminSupabase, {
      eventType: "ai_team",
      message: "AI Team founder brief generated",
      metadata: { briefId: brief.id, briefDate: brief.briefDate },
      userId: auth.user.id,
    });
    return NextResponse.json({ brief });
  } catch (error) {
    console.error("[admin/ai-team/brief] Generation failed", error);
    return NextResponse.json(
      { error: "Unable to generate founder brief." },
      { status: 500 },
    );
  }
}
