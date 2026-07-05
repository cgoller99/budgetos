import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { listAdminFeedbackReports } from "@/lib/admin/feedbackService";
import type { FeedbackPriority, FeedbackReportType, FeedbackStatus } from "@/lib/admin/types";

export async function GET(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  const params = new URL(request.url).searchParams;

  try {
    const reports = await listAdminFeedbackReports(auth.adminSupabase, {
      q: params.get("q") ?? undefined,
      status: (params.get("status") as FeedbackStatus | null) ?? undefined,
      reportType: (params.get("type") as FeedbackReportType | null) ?? undefined,
      priority: (params.get("priority") as FeedbackPriority | null) ?? undefined,
    });

    return NextResponse.json({ reports });
  } catch (error) {
    console.error("[admin/feedback] Failed", error);
    return NextResponse.json({ error: "Unable to load feedback." }, { status: 500 });
  }
}
