import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAiTeamSnapshot } from "@/lib/ai-team/snapshot";
import { signalsFromAiTeamSnapshot } from "@/lib/ai-team/signalExtraction";
import { prioritizeAutonomousSignals } from "@/lib/ai-team/autonomousPriorities";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
/** Daily scheduled evaluation, intentionally read-only: no actions, writes, or calls. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  if (process.env.JARVIS_PRIORITY_CRON_ENABLED !== "true") {
    return NextResponse.json({ enabled: false, mode: "disabled" }, { headers });
  }
  try {
    const snapshot = await getAiTeamSnapshot(createSupabaseAdminClient());
    const priorities = prioritizeAutonomousSignals(signalsFromAiTeamSnapshot(snapshot));
    console.info("[cron/jarvis-priorities] evaluation", { count: priorities.length,
      topIds: priorities.slice(0, 5).map((p) => p.id), unavailableSources: snapshot.unavailableSources });
    return NextResponse.json({ enabled: true, mode: "proposal_only", generatedAt: snapshot.generatedAt,
      priorityCount: priorities.length, topIds: priorities.slice(0, 5).map((p) => p.id),
      unavailableSources: snapshot.unavailableSources }, { headers });
  } catch (error) {
    console.error("[cron/jarvis-priorities] evaluation failed", error);
    return NextResponse.json({ error: "Priority evaluation failed." }, { status: 503, headers });
  }
}
