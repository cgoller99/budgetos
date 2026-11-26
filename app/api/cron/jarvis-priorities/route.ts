import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAiTeamSnapshot } from "@/lib/ai-team/snapshot";
import { signalsFromAiTeamSnapshot } from "@/lib/ai-team/signalExtraction";
import { prioritizeAutonomousSignals } from "@/lib/ai-team/autonomousPriorities";
import { getAdminOverviewMetrics } from "@/lib/admin/metricsService";
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
const PAID_STATUS = new Set(["active", "trialing", "past_due"]);
const PAID_PLAN = new Set(["pro", "pro_plus"]);

async function countPaid(admin: ReturnType<typeof createSupabaseAdminClient>, provider: "apple" | "stripe") {
  const { count, error } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .in("subscription_plan", [...PAID_PLAN])
    .in("subscription_status", [...PAID_STATUS])
    .eq("subscription_provider", provider);
  if (error) throw error;
  return count ?? 0;
}

async function rememberBuxme() {
  try {
    const admin = createSupabaseAdminClient();
    const [overview, apple, stripe] = await Promise.allSettled([
      getAdminOverviewMetrics(admin),
      countPaid(admin, "apple"),
      countPaid(admin, "stripe"),
    ]);
    const overviewValue = overview.status === "fulfilled" ? overview.value : null;
    const applePaid = apple.status === "fulfilled" ? apple.value : null;
    const stripePaid = stripe.status === "fulfilled" ? stripe.value : null;
    return await jarvis.recordBuxmeReading({
      users: overviewValue?.totalUsers ?? null,
      activeUsers7d: overviewValue?.activeUsers7d ?? null,
      paidUsers: applePaid == null || stripePaid == null ? null : applePaid + stripePaid,
      applePaid,
      stripePaid,
      stripeReported: false,
    });
  } catch {
    return { recorded: false };
  }
}

/** Daily schedule. The inbox check and business pass save drafts and do not send, publish, or purchase.
 *  Priority notes stay proposal-only. The GitHub proposal workflow is a separate reviewer.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  const inbox = await agencyInbox();
  const buxme = await rememberBuxme();
  if (process.env.JARVIS_PRIORITY_CRON_ENABLED !== "true") {
    return NextResponse.json({ enabled: false, mode: "disabled", inbox, buxme }, { headers });
  }
  try {
    const snapshot = await getAiTeamSnapshot(createSupabaseAdminClient());
    const priorities = prioritizeAutonomousSignals(signalsFromAiTeamSnapshot(snapshot));
    console.info("[cron/jarvis-priorities] evaluation", { count: priorities.length,
      topIds: priorities.slice(0, 5).map((p) => p.id), unavailableSources: snapshot.unavailableSources });
    return NextResponse.json({ enabled: true, mode: "proposal_only", generatedAt: snapshot.generatedAt,
      priorityCount: priorities.length, topIds: priorities.slice(0, 5).map((p) => p.id),
      unavailableSources: snapshot.unavailableSources, inbox, buxme }, { headers });
  } catch (error) {
    console.error("[cron/jarvis-priorities] evaluation failed", error);
    return NextResponse.json({ error: "Priority evaluation failed.", inbox, buxme }, { status: 503, headers });
  }
}
