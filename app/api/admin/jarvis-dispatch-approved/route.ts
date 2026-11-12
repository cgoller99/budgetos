import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
import { dispatchApprovedJarvisExecution } from "@/lib/jarvis/dispatchApprovedExecution";
import manifest from "@/data/jarvis-approved-tasks.json";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;
  const body = await request.json().catch(() => null);
  const taskUuid = body?.taskUuid;
  const allowlistedTaskId = body?.allowlistedTaskId;
  if (typeof taskUuid !== "string" || !uuid.test(taskUuid) || typeof allowlistedTaskId !== "string")
    return NextResponse.json({ error: "Invalid task selection" }, { status: 400 });
  const allowed = manifest.find(t => t.id === allowlistedTaskId && t.status === "approved");
  if (!allowed) return NextResponse.json({ error: "Task not allowlisted" }, { status: 403 });

  const { data: task, error: taskError } = await auth.adminSupabase.from("ai_team_tasks")
    .select("id,run_id,title,objective,status").eq("id", taskUuid).single();
  if (taskError || !task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  // The approved DB task must exactly describe the allowlisted action; never map arbitrary founder requests.
  if (task.status !== "approved" || task.title !== allowed.title || task.objective !== allowed.title)
    return NextResponse.json({ error: "Approved task does not exactly match allowlisted audit" }, { status: 409 });
  const { data: run } = await auth.adminSupabase.from("ai_team_runs")
    .select("created_by").eq("id", task.run_id).single();
  if (run?.created_by !== auth.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data: decision } = await auth.adminSupabase.from("ai_team_approval_decisions")
    .select("id,decision,actor_id").eq("task_id", taskUuid).eq("decision", "approved").eq("actor_id", auth.user.id).limit(1).maybeSingle();
  if (!decision) return NextResponse.json({ error: "Immutable approval not found" }, { status: 409 });

  const dispatched = await dispatchApprovedJarvisExecution(allowlistedTaskId);
  return NextResponse.json({
    dispatched,
    execution: dispatched ? "queued_for_environment_review" : "not_started",
    note: dispatched ? "GitHub accepted the workflow dispatch. Environment approval and execution results must still be verified." : "Dispatch unavailable; verify workflow on main and GitHub token.",
  }, { status: dispatched ? 202 : 503, headers: { "Cache-Control": "no-store" } });
}
