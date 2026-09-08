import "server-only";

import type {
  AiTeamRunRow,
  AiTeamTaskRow,
  Json,
} from "@/lib/supabase/database.types";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import type {
  AiTeamPlan,
  AiTeamRun,
  AiTeamRuntimeMetadata,
  AiTeamSnapshot,
  AiTeamTask,
} from "@/lib/ai-team/types";

function stringArray(value: Json): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : [];
}

function objectOrNull<T>(value: Json | undefined): T | null {
  return value && !Array.isArray(value) && typeof value === "object"
    ? (value as T)
    : null;
}

function objectArray<T>(value: Json | undefined): T[] {
  return Array.isArray(value)
    ? (value.filter(
        (item) => item && !Array.isArray(item) && typeof item === "object",
      ) as T[])
    : [];
}

function runtimeMetadataFromJson(value: Json | null): AiTeamRuntimeMetadata | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const record = value as Record<string, Json | undefined>;
  const selectedSpecialists = stringArray(record.selectedSpecialists ?? []).filter(
    (id): id is AiTeamRuntimeMetadata["selectedSpecialists"][number] =>
      [
        "chief_of_staff",
        "engineering",
        "qa",
        "analytics",
        "product",
        "growth",
        "customer",
        "critic",
      ].includes(id),
  );
  if (
    typeof record.durationMs !== "number"
  ) {
    return null;
  }

  return {
    selectedSpecialists,
    modelCallCount:
      typeof record.modelCallCount === "number"
        ? record.modelCallCount
        : undefined,
    durationMs: record.durationMs,
    inputTokens:
      typeof record.inputTokens === "number" ? record.inputTokens : undefined,
    outputTokens:
      typeof record.outputTokens === "number" ? record.outputTokens : undefined,
    totalTokens:
      typeof record.totalTokens === "number" ? record.totalTokens : undefined,
    criticSummary:
      typeof record.criticSummary === "string"
        ? record.criticSummary
        : undefined,
  };
}

function snapshotFromJson(value: Json): AiTeamSnapshot {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new Error("Invalid persisted AI Team snapshot.");
  }

  const record = value as Record<string, Json | undefined>;
  if (typeof record.generatedAt !== "string") {
    throw new Error("Invalid persisted AI Team snapshot timestamp.");
  }

  return {
    generatedAt: record.generatedAt,
    observations: stringArray(record.observations ?? []),
    unavailableSources: stringArray(record.unavailableSources ?? []),
    overview: objectOrNull<AiTeamSnapshot["overview"]>(record.overview),
    revenue: objectOrNull<AiTeamSnapshot["revenue"]>(record.revenue),
    plaid: objectOrNull<AiTeamSnapshot["plaid"]>(record.plaid),
    analytics: objectOrNull<AiTeamSnapshot["analytics"]>(record.analytics),
    health: objectArray<AiTeamSnapshot["health"][number]>(record.health),
  };
}

function taskFromRow(row: AiTeamTaskRow): AiTeamTask {
  return {
    id: row.id,
    owner: row.owner,
    title: row.title,
    objective: row.objective,
    status: row.status,
    evidence: stringArray(row.evidence),
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
    snapshot: snapshotFromJson(row.snapshot),
    runtimeMetadata: runtimeMetadataFromJson(row.runtime_metadata),
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
  const taskPayload = plan.tasks.map((task) => ({
    owner: task.owner,
    status: task.status,
    title: task.title,
    objective: task.objective,
    evidence: task.evidence,
    requires_approval: task.requiresApproval,
    approval_reason: task.requiresApproval
      ? task.approvalReason?.trim() ||
        "Production-sensitive action requires approval."
      : null,
  })) as unknown as Json;

  const { data: runId, error: saveError } = await adminSupabase.rpc(
    "save_ai_team_run_atomic",
    {
      p_created_by: createdBy,
      p_goal: plan.goal,
      p_source: plan.source,
      p_model: plan.model ?? null,
      p_summary: plan.summary,
      p_snapshot: snapshot as unknown as Json,
      p_created_at: plan.createdAt,
      p_tasks: taskPayload,
      p_runtime_metadata: plan.runtimeMetadata
        ? (plan.runtimeMetadata as unknown as Json)
        : null,
    },
  );

  if (saveError || !runId) {
    throw new Error("Unable to save AI Team run atomically.", {
      cause: saveError ?? undefined,
    });
  }

  const [{ data: run, error: runError }, { data: tasks, error: tasksError }] =
    await Promise.all([
      adminSupabase.from("ai_team_runs").select("*").eq("id", runId).single(),
      adminSupabase
        .from("ai_team_tasks")
        .select("*")
        .eq("run_id", runId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
    ]);

  if (runError || !run) {
    throw new Error("AI Team run was saved but could not be reloaded.", {
      cause: runError ?? undefined,
    });
  }

  if (tasksError) {
    throw new Error("AI Team run tasks were saved but could not be reloaded.", {
      cause: tasksError,
    });
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

export async function listAiTeamApprovalRuns(
  adminSupabase: BuxmeSupabaseClient,
): Promise<AiTeamRun[]> {
  const { data: tasks, error: tasksError } = await adminSupabase
    .from("ai_team_tasks")
    .select("*")
    .eq("requires_approval", true)
    .order("created_at", { ascending: false })
    .limit(100);

  if (tasksError) {
    throw new Error("Unable to load AI Team approval tasks.", {
      cause: tasksError,
    });
  }

  if (tasks.length === 0) return [];

  const runIds = [...new Set(tasks.map((task) => task.run_id))].slice(0, 20);
  const selectedTasks = tasks.filter((task) => runIds.includes(task.run_id));

  const { data: runs, error: runsError } = await adminSupabase
    .from("ai_team_runs")
    .select("*")
    .in("id", runIds)
    .order("created_at", { ascending: false });

  if (runsError) {
    throw new Error("Unable to load AI Team approval runs.", {
      cause: runsError,
    });
  }

  const tasksByRun = new Map<string, AiTeamTask[]>();
  for (const task of selectedTasks) {
    const runTasks = tasksByRun.get(task.run_id) ?? [];
    runTasks.push(taskFromRow(task));
    tasksByRun.set(task.run_id, runTasks);
  }

  return runs.map((run) => runFromRow(run, tasksByRun.get(run.id) ?? []));
}
