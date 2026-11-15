import { NextResponse } from "next/server";
import { runScheduledWorker } from "@/lib/jarvis/scheduledTrigger.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const headers = { "Cache-Control": "private, no-store, max-age=0" };

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  if (process.env.JARVIS_SCHEDULED_TRIGGER_ENABLED !== "true") {
    return NextResponse.json({ enabled: false, mode: "disabled" }, { headers });
  }

  try {
    const result = await runScheduledWorker();
    console.info("[cron/jarvis-scheduled] worker completed", result);
    return NextResponse.json(
      { enabled: true, mode: "bounded_approved_execution", ...result },
      { headers },
    );
  } catch (error) {
    console.error("[cron/jarvis-scheduled] worker failed", error);
    return NextResponse.json(
      { error: "Scheduled worker failed.", retryable: true },
      { status: 503, headers },
    );
  }
}
