import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { getAiTeamSnapshot } from "@/lib/ai-team/snapshot";
import { signalsFromAiTeamSnapshot } from "@/lib/ai-team/signalExtraction";
import { prioritizeAutonomousSignals } from "@/lib/ai-team/autonomousPriorities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

/** Admin-only, read-only Jarvis priority preview; never executes proposed work. */
export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;
  try {
    const snapshot = await getAiTeamSnapshot(auth.adminSupabase);
    const signals = signalsFromAiTeamSnapshot(snapshot);
    return NextResponse.json({ generatedAt: snapshot.generatedAt, mode: "proposal_only",
      unavailableSources: snapshot.unavailableSources, priorities: prioritizeAutonomousSignals(signals) }, { headers });
  } catch (error) {
    console.error("[admin/ai-team/priorities] Failed", error);
    return NextResponse.json({ error: "Unable to load Jarvis priorities." }, { status: 503, headers });
  }
}
