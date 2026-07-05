import { NextResponse } from "next/server";
import { runDuePaychecks } from "@/lib/cron/paycheckCronService";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return process.env.NODE_ENV === "development";
  }

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adminSupabase = createSupabaseAdminClient();
    const result = await runDuePaychecks(adminSupabase);

    return NextResponse.json({
      ok: true,
      ...result,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron/run-paychecks] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Paycheck cron failed.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
