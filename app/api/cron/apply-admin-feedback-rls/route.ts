import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  applySqlMigration,
  checkAdminFeedbackRlsApplied,
} from "@/lib/supabase/applySqlMigration";

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();

  if (!cronSecret) {
    return process.env.NODE_ENV === "development" && !process.env.VERCEL;
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const alreadyApplied = await checkAdminFeedbackRlsApplied();

    if (alreadyApplied) {
      return NextResponse.json({
        ok: true,
        alreadyApplied: true,
        message: "Admin feedback RLS migration already applied.",
      });
    }

    const sql = fs.readFileSync(
      path.join(process.cwd(), "supabase/migrations/20260709_admin_feedback_rls.sql"),
      "utf8",
    );
    const method = await applySqlMigration(sql);

    const verified = await checkAdminFeedbackRlsApplied();

    return NextResponse.json({
      ok: verified,
      alreadyApplied: false,
      method,
      verified,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron/apply-admin-feedback-rls] failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to apply admin feedback RLS migration.",
        hint: "Set SUPABASE_ACCESS_TOKEN or SUPABASE_DB_PASSWORD on Vercel, or run SQL manually.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
