import "server-only";

import { listAdminFeedbackReports } from "@/lib/admin/feedbackService";
import { summarizeCustomerVoice } from "@/lib/ai-team/v3Math";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";

export async function getAiTeamCustomerVoice(
  adminSupabase: BuxmeSupabaseClient,
) {
  const reports = await listAdminFeedbackReports(adminSupabase);
  return summarizeCustomerVoice(reports);
}
