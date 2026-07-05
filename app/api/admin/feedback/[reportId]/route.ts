import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import {
  updateAdminFeedbackReport,
  type FeedbackPriority,
  type FeedbackStatus,
} from "@/lib/admin/feedbackService";

type RouteContext = {
  params: Promise<{ reportId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  const { reportId } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    status?: FeedbackStatus;
    priority?: FeedbackPriority;
  };

  try {
    await updateAdminFeedbackReport(auth.adminSupabase, reportId, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/feedback/:id] Failed", error);
    return NextResponse.json({ error: "Unable to update feedback." }, { status: 500 });
  }
}
