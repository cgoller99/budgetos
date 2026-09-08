import "server-only";

import type {
  AiTeamApprovalDecisionRow,
  AiTeamPlaybookRow,
} from "@/lib/supabase/database.types";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import type {
  AiTeamApprovalDecision,
  AiTeamPlaybook,
} from "@/lib/ai-team/types";

export function approvalDecisionFromRow(
  row: AiTeamApprovalDecisionRow,
): AiTeamApprovalDecision {
  return {
    id: row.id,
    taskId: row.task_id,
    runId: row.run_id,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    decision: row.decision,
    note: row.note,
    createdAt: row.created_at,
  };
}

export function playbookFromRow(row: AiTeamPlaybookRow): AiTeamPlaybook {
  return {
    id: row.id,
    createdBy: row.created_by,
    title: row.title,
    description: row.description,
    category: row.category,
    goalTemplate: row.goal_template,
    favorite: row.favorite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAiTeamApprovalDecisions(
  adminSupabase: BuxmeSupabaseClient,
  taskIds: string[],
): Promise<AiTeamApprovalDecision[]> {
  if (taskIds.length === 0) return [];
  const { data, error } = await adminSupabase
    .from("ai_team_approval_decisions")
    .select("*")
    .in("task_id", taskIds)
    .order("created_at", { ascending: false })
    .limit(taskIds.length);

  if (error) {
    throw new Error("Unable to load AI Team approval decisions.", {
      cause: error,
    });
  }
  return data.map(approvalDecisionFromRow);
}

export async function listAiTeamPlaybooks(
  adminSupabase: BuxmeSupabaseClient,
  createdBy: string,
): Promise<AiTeamPlaybook[]> {
  const { data, error } = await adminSupabase
    .from("ai_team_playbooks")
    .select("*")
    .eq("created_by", createdBy)
    .order("favorite", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error("Unable to load AI Team playbooks.", { cause: error });
  }
  return data.map(playbookFromRow);
}
