import "server-only";

import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import type {
  AdminFeedbackReport,
  FeedbackPriority,
  FeedbackReportType,
  FeedbackStatus,
} from "@/lib/admin/types";

export type { FeedbackStatus, FeedbackPriority, AdminFeedbackReport } from "@/lib/admin/types";

export type FeedbackListFilters = {
  q?: string;
  status?: FeedbackStatus;
  reportType?: FeedbackReportType;
  priority?: FeedbackPriority;
};

export async function listAdminFeedbackReports(
  adminSupabase: BuxmeSupabaseClient,
  filters: FeedbackListFilters = {},
): Promise<AdminFeedbackReport[]> {
  let query = adminSupabase
    .from("admin_feedback_reports")
    .select(
      "id, user_id, user_email, report_type, message, category, screenshot_url, recording_url, browser, device, app_version, page_path, status, priority, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.reportType) {
    query = query.eq("report_type", filters.reportType);
  }

  if (filters.priority) {
    query = query.eq("priority", filters.priority);
  }

  if (filters.q?.trim()) {
    query = query.or(
      `message.ilike.%${filters.q.trim()}%,user_email.ilike.%${filters.q.trim()}%,page_path.ilike.%${filters.q.trim()}%`,
    );
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const rows = data ?? [];
  const userIds = [...new Set(rows.map((row) => row.user_id).filter(Boolean))] as string[];
  const profilesById = new Map<string, { email: string | null; full_name: string | null }>();

  if (userIds.length > 0) {
    const { data: profiles } = await adminSupabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", userIds);

    for (const profile of profiles ?? []) {
      profilesById.set(profile.id, {
        email: profile.email,
        full_name: profile.full_name,
      });
    }
  }

  return rows.map((row) => {
    const profile = row.user_id ? profilesById.get(row.user_id) : undefined;

    return {
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email ?? profile?.email ?? null,
      userName: profile?.full_name ?? null,
      reportType: row.report_type as FeedbackReportType,
      message: row.message,
      category: row.category,
      screenshotUrl: row.screenshot_url,
      recordingUrl: row.recording_url,
      browser: row.browser,
      device: row.device,
      appVersion: row.app_version,
      pagePath: row.page_path,
      status: row.status as FeedbackStatus,
      priority: row.priority as FeedbackPriority,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

export async function updateAdminFeedbackReport(
  adminSupabase: BuxmeSupabaseClient,
  reportId: string,
  input: Partial<{ status: FeedbackStatus; priority: FeedbackPriority }>,
): Promise<void> {
  const { error } = await adminSupabase
    .from("admin_feedback_reports")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reportId);

  if (error) {
    throw error;
  }
}
