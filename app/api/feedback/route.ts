import { NextResponse } from "next/server";
import { ANALYTICS_EVENTS } from "@/lib/analytics/events";
import type { FeedbackCategory, FeedbackPriority, FeedbackReportType } from "@/lib/feedback/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "0.1.0";

type FeedbackRequestBody = {
  reportType?: FeedbackReportType;
  message?: string;
  category?: FeedbackCategory;
  priority?: FeedbackPriority;
  screenshotUrl?: string;
  recordingUrl?: string;
  browser?: string;
  device?: string;
  pagePath?: string;
  appVersion?: string;
};

function normalizeReportType(value: string | undefined): FeedbackReportType {
  if (value === "bug" || value === "feature_request") {
    return value;
  }

  return "feedback";
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as FeedbackRequestBody;
  const message = body.message?.trim();

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("admin_feedback_reports")
    .insert({
      user_id: user.id,
      user_email: profile?.email ?? user.email ?? null,
      report_type: normalizeReportType(body.reportType),
      message,
      category: body.category ?? null,
      priority: body.priority ?? "normal",
      screenshot_url: body.screenshotUrl?.trim() || null,
      recording_url: body.recordingUrl?.trim() || null,
      browser: body.browser?.trim() || null,
      device: body.device?.trim() || null,
      app_version: body.appVersion?.trim() || APP_VERSION,
      page_path: body.pagePath?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[feedback] Failed to create report", error);
    return NextResponse.json({ error: "Unable to submit feedback." }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    id: data.id,
    analyticsEvent: ANALYTICS_EVENTS.COMPLETED_FEEDBACK,
  });
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("admin_feedback_reports")
    .select(
      "id, report_type, message, category, status, priority, page_path, created_at, updated_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: "Unable to load feedback." }, { status: 500 });
  }

  return NextResponse.json({ reports: data ?? [] });
}
