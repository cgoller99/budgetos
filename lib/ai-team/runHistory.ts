import "server-only";

import type {
  AiTeamRunRow,
  AiTeamTaskInsert,
  AiTeamTaskRow,
  Json,
} from "@/lib/supabase/database.types";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import type {
  AiTeamPlan,
  AiTeamRun,
  AiTeamSnapshot,
  AiTeamTask,
} from "@/lib/ai-team/types";

function taskFromRow(row: AiTeamTaskRow): AiTeamTask {
  return {
    id: row.id,
    owner: row.owner,
    title: row.title,
    objective: row.objective,
    status: row.status,
    evidence: row.evidence as string[],
    requiresApproval: row.requires_approval,
    approvalReason: row.approval_reason ?? undefined,
  };
}

function runFromRow(row: AiTeamRunRow, tasks: AiTeamTask[]): AiTeamRun {
  return {
    id: row.id,
    createdBy: row.created_by,
    goal: row.goal,
    source: row.source,
    model: row.model,
    summary: row.summary,
    snapshot: row.snapshot as unknown as AiTeamSnapshot,
    createdAt: row.created_at,
    tasks,
  };
}

export async function saveAiTeamRun(
  adminSupabase: BuxmeSupabaseClient,
  createdBy: string,
  plan: AiTeamPlan,
  snapshot: AiTeamSnapshot,
): Promise<AiTeamRun> {
  const { data: run, error: runError } = await adminSupabase
    .from("ai_team_runs")
    .insert({
      created_by: createdBy,
      goal: plan.goal,
      source: plan.source,
      model: plan.model ?? null,
      summary: plan.summary,
      snapshot: snapshot as unknown as Json,
      created_at: plan.createdAt,
    })
    .select("*")
    .single();

  if (runError) {
    throw new Error("Unable to save AI Team run.", { cause: runError });
  }

  const taskRows: AiTeamTaskInsert[] = plan.tasks.map((task) => ({
    run_id: run.id,
    owner: task.owner,
    status: task.status,
    title: task.title,
    objective: task.objective,
    evidence: task.evidence,
    requires_approval: task.requiresApproval,
    approval_reason: task.requiresApproval
      ? task.approvalReason ?? "Production-sensitive action requires approval."
      : null,
    created_at: plan.createdAt,
  }));

  const { data: tasks, error: tasksError } = await adminSupabase
    .from("ai_team_tasks")
    .insert(taskRows)
    .select("*");

  if (tasksError) {
    const { error: cleanupError } = await adminSupabase
      .from("ai_team_runs")
      .delete()
      .eq("id", run.id);

    if (cleanupError) {
      console.error("[ai-team/history] Failed to clean up incomplete run", cleanupError);
    }

    throw new Error("Unable to save AI Team run tasks.", { cause: tasksError });
  }

  return runFromRow(run, tasks.map(taskFromRow));
}

export async function listRecentAiTeamRuns(
  adminSupabase: BuxmeSupabaseClient,
): Promise<AiTeamRun[]> {
  const { data: runs, error: runsError } = await adminSupabase
    .from("ai_team_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (runsError) {
    throw new Error("Unable to load AI Team runs.", { cause: runsError });
  }

  if (runs.length === 0) return [];

  const { data: tasks, error: tasksError } = await adminSupabase
    .from("ai_team_tasks")
    .select("*")
    .in(
      "run_id",
      runs.map((run) => run.id),
    )
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (tasksError) {
    throw new Error("Unable to load AI Team run tasks.", { cause: tasksError });
  }

  const tasksByRun = new Map<string, AiTeamTask[]>();
  for (const task of tasks) {
    const runTasks = tasksByRun.get(task.run_id) ?? [];
    runTasks.push(taskFromRow(task));
    tasksByRun.set(task.run_id, runTasks);
  }

  return runs.map((run) => runFromRow(run, tasksByRun.get(run.id) ?? []));
}
