import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { logAdminEvent } from "@/lib/admin/eventLog";
import { approvalDecisionFromRow } from "@/lib/ai-team";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as
    | { taskId?: unknown; decision?: unknown; note?: unknown }
    | null;
  const taskId = typeof body?.taskId === "string" ? body.taskId : "";
  const decision = body?.decision;
  const note = typeof body?.note === "string" ? body.note.trim() : "";

  if (
    !UUID_PATTERN.test(taskId) ||
    (decision !== "approved" && decision !== "rejected") ||
    note.length > 1000
  ) {
    return NextResponse.json(
      { error: "Invalid approval decision." },
      { status: 400 },
    );
  }

  const { data, error } = await auth.adminSupabase
    .rpc("record_ai_team_approval_decision", {
      p_task_id: taskId,
      p_actor_id: auth.user.id,
      p_actor_email: auth.user.email ?? "",
      p_decision: decision,
      p_note: note,
    })
    .single();

  if (error || !data) {
    if (error?.code === "P0002") {
      return NextResponse.json(
        { error: "Approval task not found." },
        { status: 404 },
      );
    }
    if (error?.code === "42501") {
      return NextResponse.json(
        { error: "This approval task does not belong to your admin account." },
        { status: 403 },
      );
    }
    if (error?.code === "23505" || error?.code === "23514") {
      return NextResponse.json(
        { error: "This task is not waiting for an approval decision." },
        { status: 409 },
      );
    }
    console.error("[admin/ai-team/approvals] Decision persistence failed", error);
    return NextResponse.json(
      { error: "Unable to record the approval decision." },
      { status: 500 },
    );
  }

  await logAdminEvent(auth.adminSupabase, {
    eventType: "ai_team",
    message: "AI Team approval decision recorded",
    metadata: {
      decision,
      taskId: data.task_id,
      runId: data.run_id,
    },
    userId: auth.user.id,
  });

  return NextResponse.json({
    decision: approvalDecisionFromRow(data),
    executed: false,
  });
}
