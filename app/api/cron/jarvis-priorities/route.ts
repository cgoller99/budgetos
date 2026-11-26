import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAiTeamSnapshot } from "@/lib/ai-team/snapshot";
import { signalsFromAiTeamSnapshot } from "@/lib/ai-team/signalExtraction";
import { prioritizeAutonomousSignals } from "@/lib/ai-team/autonomousPriorities";
import { createApp } from "../../../../apps/jarvis/lib/app.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
const jarvis = createApp({
  dataDir: process.env.JARVIS_DATA_DIR || (process.env.VERCEL === "1" ? "/tmp/jarvis" : undefined),
});
async function agencyInbox() {
  try {
    return await jarvis.collectInbox();
  } catch {
    return { connected: false, reason: "Inbox check failed.", created: 0, duplicates: 0, drafts: [], sent: false };
  }
}
/** Business execution runs every hour at minute 15 UTC (`15 * * * *`), including 7:15 UTC.
 *  collectInbox is that worker. It does not send mail, dial outside 8:00 AM–9:00 PM ET, or repeat a finished hour.
 *  The priority block below stays proposal-only. The GitHub workflow jarvis-proposals.yml is a separate reviewer and is not this worker.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  const inbox = await agencyInbox();
  if (process.env.JARVIS_PRIORITY_CRON_ENABLED !== "true") {
    return NextResponse.json({ enabled: false, mode: "disabled", inbox }, { headers });
  }
  try {
    const snapshot = await getAiTeamSnapshot(createSupabaseAdminClient());
    const priorities = prioritizeAutonomousSignals(signalsFromAiTeamSnapshot(snapshot));
    console.info("[cron/jarvis-priorities] evaluation", { count: priorities.length,
      topIds: priorities.slice(0, 5).map((p) => p.id), unavailableSources: snapshot.unavailableSources });
    return NextResponse.json({ enabled: true, mode: "proposal_only", generatedAt: snapshot.generatedAt,
      priorityCount: priorities.length, topIds: priorities.slice(0, 5).map((p) => p.id),
      unavailableSources: snapshot.unavailableSources, inbox }, { headers });
  } catch (error) {
    console.error("[cron/jarvis-priorities] evaluation failed", error);
    return NextResponse.json({ error: "Priority evaluation failed.", inbox }, { status: 503, headers });
  }
}
