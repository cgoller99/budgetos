import "server-only";

import type {
  AiTeamApprovalDecisionRow,
  AiTeamExecutionPacketRow,
  AiTeamTaskRow,
  Json,
} from "@/lib/supabase/database.types";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import { approvalDecisionFromRow } from "@/lib/ai-team/operations";
import type {
  AiTeamExecutionCandidate,
  AiTeamExecutionPacket,
  AiTeamTask,
} from "@/lib/ai-team/types";

function record(value: Json): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function strings(value: Json): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function taskFromRow(row: AiTeamTaskRow): AiTeamTask {
  return {
    id: row.id,
    owner: row.owner,
    title: row.title,
    objective: row.objective,
    status: row.status,
    evidence: strings(row.evidence),
    requiresApproval: row.requires_approval,
    approvalReason: row.approval_reason ?? undefined,
  };
}

export function executionPacketFromRow(
  row: AiTeamExecutionPacketRow,
): AiTeamExecutionPacket {
  return {
    id: row.id,
    taskId: row.task_id,
    runId: row.run_id,
    approvalDecisionId: row.approval_decision_id,
    createdBy: row.created_by,
    status: row.status,
    task: record(row.task_snapshot),
    run: record(row.run_snapshot),
    approval: record(row.approval_snapshot),
    evidence: strings(row.evidence),
    proposedBranchName: row.proposed_branch_name,
    implementationBrief: row.implementation_brief,
    validationChecklist: strings(row.validation_checklist),
    rollbackNotes: row.rollback_notes,
    requiresExternalOperator: true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAiTeamExecutionPackets(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
): Promise<AiTeamExecutionPacket[]> {
  const { data, error } = await adminSupabase
    .from("ai_team_execution_packets")
    .select("*")
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error("Unable to load execution packets.", { cause: error });
  }
  return data.map(executionPacketFromRow);
}

export async function listAiTeamExecutionCandidates(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
): Promise<AiTeamExecutionCandidate[]> {
  const { data: userRuns, error: userRunsError } = await adminSupabase
    .from("ai_team_runs")
    .select("id")
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (userRunsError) {
    throw new Error("Unable to load execution candidate ownership.", {
      cause: userRunsError,
    });
  }
  if (userRuns.length === 0) return [];

  const { data: decisions, error: decisionError } = await adminSupabase
    .from("ai_team_approval_decisions")
    .select("*")
    .in(
      "run_id",
      userRuns.map((run) => run.id),
    )
    .eq("decision", "approved")
    .order("created_at", { ascending: false })
    .limit(100);

  if (decisionError) {
    throw new Error("Unable to load approved execution decisions.", {
      cause: decisionError,
    });
  }
  if (decisions.length === 0) return [];

  const taskIds = decisions.map((decision) => decision.task_id);
  const [{ data: tasks, error: taskError }, { data: packets, error: packetError }] =
    await Promise.all([
      adminSupabase
        .from("ai_team_tasks")
        .select("*")
        .in("id", taskIds)
        .eq("status", "approved"),
      adminSupabase
        .from("ai_team_execution_packets")
        .select("task_id")
        .in("task_id", taskIds),
    ]);

  if (taskError) {
    throw new Error("Unable to load approved execution tasks.", {
      cause: taskError,
    });
  }
  if (packetError) {
    throw new Error("Unable to load staged execution tasks.", {
      cause: packetError,
    });
  }

  const stagedTaskIds = new Set(packets.map((packet) => packet.task_id));
  const eligibleTasks = tasks.filter((task) => !stagedTaskIds.has(task.id));
  if (eligibleTasks.length === 0) return [];

  const runIds = [...new Set(eligibleTasks.map((task) => task.run_id))];
  const { data: runs, error: runError } = await adminSupabase
    .from("ai_team_runs")
    .select("id, goal, summary, created_at")
    .in("id", runIds);

  if (runError) {
    throw new Error("Unable to load approved execution runs.", {
      cause: runError,
    });
  }

  const tasksById = new Map(eligibleTasks.map((task) => [task.id, task]));
  const runsById = new Map(runs.map((run) => [run.id, run]));
  const decisionsByTask = new Map(
    (decisions as AiTeamApprovalDecisionRow[]).map((decision) => [
      decision.task_id,
      decision,
    ]),
  );

  return taskIds.flatMap((taskId) => {
    const task = tasksById.get(taskId);
    if (!task) return [];
    const run = runsById.get(task.run_id);
    const decision = decisionsByTask.get(task.id);
    if (!run || !decision) return [];

    return [
      {
        task: taskFromRow(task),
        run: {
          id: run.id,
          goal: run.goal,
          summary: run.summary,
          createdAt: run.created_at,
        },
        decision: approvalDecisionFromRow(decision),
      },
    ];
  });
}

export async function stageAiTeamExecutionPacket(
  adminSupabase: BuxmeSupabaseClient,
  input: {
    taskId: string;
    createdBy: string;
    proposedBranchName: string;
    implementationBrief: string;
    validationChecklist: string[];
    rollbackNotes: string;
  },
): Promise<AiTeamExecutionPacket> {
  const { data, error } = await adminSupabase
    .rpc("stage_ai_team_execution_packet", {
      p_task_id: input.taskId,
      p_created_by: input.createdBy,
      p_proposed_branch_name: input.proposedBranchName,
      p_implementation_brief: input.implementationBrief,
      p_validation_checklist: input.validationChecklist as unknown as Json,
      p_rollback_notes: input.rollbackNotes,
    })
    .single();

  if (error || !data) {
    throw Object.assign(
      new Error("Unable to stage execution packet.", { cause: error ?? undefined }),
      { code: error?.code },
    );
  }
  return executionPacketFromRow(data);
}
