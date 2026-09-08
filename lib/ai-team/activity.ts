import "server-only";

import type {
  AiTeamActivityEventRow,
  AiTeamActivityStatus,
} from "@/lib/supabase/database.types";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import type {
  AiTeamActivityEvent,
  AiTeamAgentId,
} from "@/lib/ai-team/types";

const AGENT_IDS = new Set<AiTeamAgentId>([
  "chief_of_staff",
  "engineering",
  "qa",
  "analytics",
  "product",
  "growth",
  "customer",
  "critic",
]);

const ACTIVITY_STATUSES = new Set<AiTeamActivityStatus>([
  "pending",
  "running",
  "completed",
  "warning",
  "failed",
]);

type AppendActivityInput = {
  operationId: string;
  createdBy: string;
  runId?: string;
  agentId?: AiTeamAgentId;
  phase: string;
  status: AiTeamActivityStatus;
  label: string;
  detail?: string;
  ordinal: number;
};

function boundedText(value: string, maximum: number): string {
  return value.trim().slice(0, maximum);
}

export function aiTeamActivityFromRow(
  row: AiTeamActivityEventRow,
): AiTeamActivityEvent {
  if (!ACTIVITY_STATUSES.has(row.status)) {
    throw new Error("Invalid AI Team activity status.");
  }
  if (row.agent_id !== null && !AGENT_IDS.has(row.agent_id)) {
    throw new Error("Invalid AI Team activity agent.");
  }

  return {
    id: row.id,
    operationId: row.operation_id,
    createdBy: row.created_by,
    runId: row.run_id,
    agentId: row.agent_id,
    phase: boundedText(row.phase, 80),
    status: row.status,
    label: boundedText(row.label, 160),
    detail: row.detail ? boundedText(row.detail, 1000) : null,
    ordinal: row.ordinal,
    createdAt: row.created_at,
  };
}

export async function appendAiTeamActivity(
  adminSupabase: BuxmeSupabaseClient,
  input: AppendActivityInput,
): Promise<AiTeamActivityEvent> {
  const phase = boundedText(input.phase, 80);
  const label = boundedText(input.label, 160);
  if (!phase || !label) {
    throw new Error("AI Team activity phase and label are required.");
  }

  const { data, error } = await adminSupabase
    .from("ai_team_activity_events")
    .insert({
      operation_id: input.operationId,
      created_by: input.createdBy,
      run_id: input.runId ?? null,
      agent_id: input.agentId ?? null,
      phase,
      status: input.status,
      label,
      detail: input.detail ? boundedText(input.detail, 1000) : null,
      ordinal: input.ordinal,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error("Unable to append AI Team activity.", {
      cause: error ?? undefined,
    });
  }

  return aiTeamActivityFromRow(data);
}

export async function listAiTeamActivity(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  operationId: string,
): Promise<AiTeamActivityEvent[]> {
  const { data, error } = await adminSupabase
    .from("ai_team_activity_events")
    .select("*")
    .eq("created_by", userId)
    .eq("operation_id", operationId)
    .order("ordinal", { ascending: true });

  if (error) {
    throw new Error("Unable to load AI Team activity.", { cause: error });
  }

  return data.map(aiTeamActivityFromRow);
}

export async function attachAiTeamActivityRun(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  operationId: string,
  runId: string,
): Promise<void> {
  const { error } = await adminSupabase
    .from("ai_team_activity_events")
    .update({ run_id: runId })
    .eq("created_by", userId)
    .eq("operation_id", operationId)
    .is("run_id", null);

  if (error) {
    throw new Error("Unable to attach the AI Team run to its activity.", {
      cause: error,
    });
  }
}
