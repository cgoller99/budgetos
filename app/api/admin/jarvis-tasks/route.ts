import { dispatchJarvisProposal } from "@/lib/jarvis/dispatchProposal";
import { coordinateJarvis } from "@/lib/ai-team/jarvisCoordinator.mjs";
import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/admin/apiAuth";
export const dynamic = "force-dynamic";
const noCache = { "Cache-Control": "no-store" };
export async function GET() {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;
  const { data, error } = await auth.adminSupabase.from("ai_team_runs").select("id,goal,created_at,ai_team_tasks(id,title,objective,status,requires_approval,created_at)").eq("created_by", auth.user.id).eq("source", "fallback").order("created_at", { ascending: false }).limit(30);
  if (error) return NextResponse.json({ error: "Task storage unavailable" }, { status: 503 });
  const runs = data ?? [];
  const tasks = runs.flatMap(run => (run.ai_team_tasks ?? []).map(task => ({
    ...task, run_id: run.id, created_at: task.created_at ?? run.created_at,
  })));
  const assignments = coordinateJarvis(tasks.map(t => t.title));
  const agentTasks = tasks.map((task, i) => ({
    ...task,
    agent: assignments.tasks[i]?.agent ?? null,
    risk: assignments.tasks[i]?.risk ?? "review_required",
    execution: "not_started",
  }));
  return NextResponse.json({ runs, agentTasks, workers: assignments.workers, mode: "proposal_only" }, { headers: noCache });
}
export async function POST(request: Request) {
  const auth = await requireAdminApiUser();
  if ("response" in auth) return auth.response;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const goal = body && typeof body === "object" ? (body as { goal?: unknown }).goal : undefined;
  if (typeof goal !== "string" || goal.trim().length < 3 || goal.trim().length > 600) return NextResponse.json({ error: "Task must be 3-600 characters" }, { status: 400 });
  const title = goal.trim().slice(0, 140);
  const { data: run, error: runError } = await auth.adminSupabase.from("ai_team_runs").insert({
    created_by: auth.user.id, goal: goal.trim(), source: "fallback", summary: "Founder-requested Jarvis task; awaiting review and execution.", snapshot: { origin: "jarvis_chat", state: "proposal_only" },
  }).select("id").single();
  if (runError || !run) return NextResponse.json({ error: "Could not save task" }, { status: 503 });
  const { data: task, error } = await auth.adminSupabase.from("ai_team_tasks").insert({
    run_id: run.id, owner: "engineering", status: "needs_approval", title, objective: goal.trim(), requires_approval: true, approval_reason: "Review required before connecting this request to an execution worker.", evidence: [],
  }).select("id,title,status").single();
  if (error || !task) {
    await auth.adminSupabase.from("ai_team_runs").delete().eq("id", run.id);
    return NextResponse.json({ error: "Could not save task" }, { status: 503 });
  }
  const proposalDispatched = await dispatchJarvisProposal(goal.trim());
  return NextResponse.json({ task, proposalDispatched, execution: "not_started" }, { status: 201, headers: noCache });
}
