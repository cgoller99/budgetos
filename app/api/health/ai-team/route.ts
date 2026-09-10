import { NextResponse } from "next/server";
import { isAiTeamModelRuntimeAvailable } from "@/lib/ai-team/modelRuntime";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";

export const runtime = "nodejs";

async function persistenceIsConfigured(): Promise<boolean> {
  if (!getSupabaseConfig().isConfigured) return false;

  try {
    const adminSupabase = createSupabaseAdminClient();
    const checks = await Promise.all([
      adminSupabase
        .from("ai_team_runs")
        .select("id, runtime_metadata", { head: true, count: "exact" }),
      adminSupabase
        .from("ai_team_tasks")
        .select("id", { head: true, count: "exact" }),
      adminSupabase
        .from("ai_team_approval_decisions")
        .select("id", { head: true, count: "exact" }),
      adminSupabase
        .from("ai_team_playbooks")
        .select("id", { head: true, count: "exact" }),
      adminSupabase
        .from("ai_team_execution_packets")
        .select("id", { head: true, count: "exact" }),
      adminSupabase
        .from("ai_team_founder_briefs")
        .select("id", { head: true, count: "exact" }),
      adminSupabase
        .from("ai_team_activity_events")
        .select("id", { head: true, count: "exact" }),
      adminSupabase
        .from("ai_team_missions")
        .select("id", { head: true, count: "exact" }),
      adminSupabase
        .from("ai_team_mission_events")
        .select("id", { head: true, count: "exact" }),
      adminSupabase
        .from("ai_team_mission_changes")
        .select("id", { head: true, count: "exact" }),
      adminSupabase
        .from("ai_team_mission_verifications")
        .select("id", { head: true, count: "exact" }),
    ]);
    return checks.every((result) => !result.error);
  } catch {
    return false;
  }
}

export async function GET() {
  const persistenceConfigured = await persistenceIsConfigured();
  const runtimeConfigured = isAiTeamModelRuntimeAvailable();
  const ready = persistenceConfigured && runtimeConfigured;

  return NextResponse.json(
    {
      ok: ready,
      version: "5.1.0",
      ready,
      persistenceConfigured,
      runtimeConfigured,
      features: {
        approvedExecution: persistenceConfigured,
        productAnalytics: true,
        revenueIntelligence: true,
        customerVoice: true,
        founderBrief: persistenceConfigured,
        liveActivityTrace: persistenceConfigured,
        missionEngine: persistenceConfigured,
        voiceInterface: true,
        screenPermissionShell: true,
        autonomyPolicy: true,
        intelligenceReports: persistenceConfigured,
      },
    },
    { status: ready ? 200 : 503 },
  );
}
