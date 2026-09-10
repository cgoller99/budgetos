import "server-only";

import type {
  AiTeamMissionChangeRow,
  AiTeamMissionEventRow,
  AiTeamMissionRow,
  AiTeamMissionVerificationRow,
  Json,
} from "@/lib/supabase/database.types";
import type { BuxmeSupabaseClient } from "@/lib/supabase/client";
import { buildAiTeamIntelligenceReport } from "@/lib/ai-team/missionReports";
import type {
  AiTeamAgentId,
  AiTeamAutonomyLevel,
  AiTeamIntelligenceReport,
  AiTeamMission,
  AiTeamMissionChange,
  AiTeamMissionEvent,
  AiTeamMissionEventStatus,
  AiTeamMissionStatus,
  AiTeamMissionVerification,
  AiTeamRun,
  AiTeamVerificationStatus,
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
const MISSION_STATUSES = new Set<AiTeamMissionStatus>([
  "received",
  "planning",
  "running",
  "waiting_approval",
  "verifying",
  "completed",
  "partial",
  "failed",
  "stopped",
]);
const AUTONOMY_LEVELS = new Set<AiTeamAutonomyLevel>([
  "observe",
  "assist",
  "act",
  "autopilot",
]);
const EVENT_STATUSES = new Set<AiTeamMissionEventStatus>([
  "pending",
  "running",
  "completed",
  "warning",
  "failed",
  "stopped",
]);
const VERIFICATION_STATUSES = new Set<AiTeamVerificationStatus>([
  "passed",
  "failed",
  "not_applicable",
]);
const TERMINAL_STATUSES = new Set<AiTeamMissionStatus>([
  "completed",
  "partial",
  "failed",
  "stopped",
]);
const NON_TERMINAL_STATUSES: AiTeamMissionStatus[] = [
  "received",
  "planning",
  "running",
  "waiting_approval",
  "verifying",
];
const FORBIDDEN_STORAGE_KEY_PARTS = [
  "prompt",
  "rawoutput",
  "chainofthought",
  "reasoning",
  "thoughts",
  "secret",
  "credential",
  "token",
  "password",
  "screenshot",
  "systemmessage",
  "developermessage",
];
const PRIVATE_STORAGE_VALUE =
  /\b(chain[-_\s]?of[-_\s]?thought|hidden(?:\s+model)?\s+reasoning|internal\s+reasoning|private\s+reasoning|scratchpad|system[-_\s]?prompt|developer[-_\s]?message|raw\s+(?:model\s+)?output)\b/i;
const BEARER_CREDENTIAL =
  /\bbearer\s+[a-z0-9._~+/=-]{12,}\b/i;
const JWT_CREDENTIAL =
  /\beyJ[a-z0-9_-]{8,}\.eyJ[a-z0-9_-]{8,}\.[a-z0-9_-]{8,}\b/i;
const API_KEY_CREDENTIAL =
  /\b(?:(?:api|secret)[-_\s]?key|access[-_\s]?token|password)\s*[:=]\s*["']?[a-z0-9_./+=-]{12,}/i;
const PREFIXED_CREDENTIAL =
  /\b(?:sk|rk|pk)[-_][a-z0-9_-]{16,}\b|\bAIza[a-z0-9_-]{20,}\b|\bgh[pousr]_[a-z0-9]{20,}\b|\bxox[baprs]-[a-z0-9-]{16,}\b|\bAKIA[A-Z0-9]{16}\b/i;
const DATA_URL = /^\s*data:[^,]+,/i;
const REDACTED_STORAGE_VALUE = "[REDACTED]";

function boundedText(value: string, maximum: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maximum);
}

function isForbiddenStorageKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return FORBIDDEN_STORAGE_KEY_PARTS.some((part) =>
    normalized.includes(part),
  );
}

function safeStringValue(value: string, maximum: number): string {
  if (
    DATA_URL.test(value) ||
    PRIVATE_STORAGE_VALUE.test(value) ||
    BEARER_CREDENTIAL.test(value) ||
    JWT_CREDENTIAL.test(value) ||
    API_KEY_CREDENTIAL.test(value) ||
    PREFIXED_CREDENTIAL.test(value)
  ) {
    return REDACTED_STORAGE_VALUE;
  }
  return boundedText(value, maximum);
}

function safeObject(value: unknown, depth = 0): Record<string, Json> {
  if (
    depth > 3 ||
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }
  const result: Record<string, Json> = {};
  for (const [key, item] of Object.entries(value).slice(0, 30)) {
    if (isForbiddenStorageKey(key)) continue;
    const safeKey = boundedText(key, 80);
    if (!safeKey) continue;
    if (
      item === null ||
      typeof item === "boolean" ||
      (typeof item === "number" && Number.isFinite(item))
    ) {
      result[safeKey] = item;
    } else if (typeof item === "string") {
      result[safeKey] = safeStringValue(item, 500);
    } else if (Array.isArray(item)) {
      result[safeKey] = item
        .slice(0, 20)
        .map((entry) =>
          typeof entry === "string"
            ? safeStringValue(entry, 300)
            : typeof entry === "number" || typeof entry === "boolean"
              ? entry
              : safeObject(entry, depth + 1),
        ) as Json;
    } else {
      result[safeKey] = safeObject(item, depth + 1);
    }
  }
  return result;
}

function reportFromJson(value: Json | null): AiTeamIntelligenceReport | null {
  if (!value || Array.isArray(value) || typeof value !== "object") return null;
  const report = value as Record<string, Json | undefined>;
  if (
    typeof report.command !== "string" ||
    typeof report.status !== "string" ||
    !MISSION_STATUSES.has(report.status as AiTeamMissionStatus) ||
    typeof report.elapsedTimeMs !== "number" ||
    !Number.isFinite(report.elapsedTimeMs)
  ) {
    return null;
  }
  const strings = (field: string): string[] => {
    const item = report[field];
    return Array.isArray(item)
      ? item
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => boundedText(entry, 1000))
          .filter(Boolean)
          .slice(0, 20)
      : [];
  };
  const verificationResults = Array.isArray(report.verificationResults)
    ? report.verificationResults.flatMap((item) => {
        if (!item || Array.isArray(item) || typeof item !== "object") return [];
        const check = item as Record<string, Json | undefined>;
        if (
          typeof check.checkType !== "string" ||
          typeof check.summary !== "string" ||
          typeof check.status !== "string" ||
          !VERIFICATION_STATUSES.has(
            check.status as AiTeamVerificationStatus,
          )
        ) {
          return [];
        }
        return [
          {
            checkType: boundedText(check.checkType, 100),
            status: check.status as AiTeamVerificationStatus,
            summary: boundedText(check.summary, 500),
          },
        ];
      })
    : [];
  return {
    command: boundedText(report.command, 1000),
    status: report.status as AiTeamMissionStatus,
    elapsedTimeMs: Math.max(0, Math.round(report.elapsedTimeMs)),
    agentsUsed: strings("agentsUsed"),
    whatWasRequested: strings("whatWasRequested"),
    whatTheTeamDid: strings("whatTheTeamDid"),
    whatItFound: strings("whatItFound"),
    whatChanged: strings("whatChanged"),
    filesDataActionsAffected: strings("filesDataActionsAffected"),
    importantFindings: strings("importantFindings"),
    warnings: strings("warnings"),
    whatCouldNotBeCompleted: strings("whatCouldNotBeCompleted"),
    verificationResults,
    recommendedNextActions: strings("recommendedNextActions"),
  };
}

function missionEventFromRow(row: AiTeamMissionEventRow): AiTeamMissionEvent {
  if (!EVENT_STATUSES.has(row.status)) {
    throw new Error("Invalid persisted mission event status.");
  }
  if (row.agent_id && !AGENT_IDS.has(row.agent_id)) {
    throw new Error("Invalid persisted mission event agent.");
  }
  return {
    id: row.id,
    missionId: row.mission_id,
    createdBy: row.created_by,
    phase: boundedText(row.phase, 80),
    eventType: boundedText(row.event_type, 80),
    agentId: row.agent_id,
    toolName: row.tool_name ? boundedText(row.tool_name, 100) : null,
    status: row.status,
    summary: boundedText(row.summary, 160),
    detail: row.detail ? boundedText(row.detail, 1000) : null,
    metadata: safeObject(row.metadata),
    ordinal: row.ordinal,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}

function missionChangeFromRow(row: AiTeamMissionChangeRow): AiTeamMissionChange {
  return {
    id: row.id,
    missionId: row.mission_id,
    createdBy: row.created_by,
    targetType: boundedText(row.target_type, 60),
    targetRef: boundedText(row.target_ref, 500),
    action: boundedText(row.action, 80),
    beforeSnapshot: row.before_snapshot
      ? safeObject(row.before_snapshot)
      : null,
    afterSnapshot: row.after_snapshot ? safeObject(row.after_snapshot) : null,
    summary: boundedText(row.summary, 500),
    verified: row.verified,
    createdAt: row.created_at,
  };
}

function missionVerificationFromRow(
  row: AiTeamMissionVerificationRow,
): AiTeamMissionVerification {
  if (!VERIFICATION_STATUSES.has(row.status)) {
    throw new Error("Invalid persisted mission verification status.");
  }
  return {
    id: row.id,
    missionId: row.mission_id,
    createdBy: row.created_by,
    checkType: boundedText(row.check_type, 100),
    status: row.status,
    summary: boundedText(row.summary, 500),
    evidence: safeObject(row.evidence),
    createdAt: row.created_at,
  };
}

function missionFromRow(
  row: AiTeamMissionRow,
  events: AiTeamMissionEvent[] = [],
  changes: AiTeamMissionChange[] = [],
  verifications: AiTeamMissionVerification[] = [],
): AiTeamMission {
  if (
    !MISSION_STATUSES.has(row.status) ||
    !AUTONOMY_LEVELS.has(row.autonomy_level)
  ) {
    throw new Error("Invalid persisted mission.");
  }
  return {
    id: row.id,
    createdBy: row.created_by,
    runId: row.run_id,
    operationId: row.operation_id,
    command: boundedText(row.command, 1000),
    status: row.status,
    autonomyLevel: row.autonomy_level,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    stopRequestedAt: row.stop_requested_at,
    elapsedMs: row.elapsed_ms,
    verified: row.verified,
    finalReport: reportFromJson(row.final_report),
    context: safeObject(row.context),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    events,
    changes,
    verifications,
  };
}

export async function createAiTeamMission(
  adminSupabase: BuxmeSupabaseClient,
  input: {
    createdBy: string;
    operationId: string;
    command: string;
    autonomyLevel: AiTeamAutonomyLevel;
    context?: Record<string, unknown>;
  },
): Promise<AiTeamMission> {
  const command = boundedText(input.command, 1000);
  if (command.length < 3 || !AUTONOMY_LEVELS.has(input.autonomyLevel)) {
    throw new Error("Invalid AI Team mission input.");
  }
  const { data, error } = await adminSupabase
    .from("ai_team_missions")
    .insert({
      created_by: input.createdBy,
      operation_id: input.operationId,
      command,
      autonomy_level: input.autonomyLevel,
      context: safeObject(input.context),
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("Unable to create AI Team mission.", {
      cause: error ?? undefined,
    });
  }
  const mission = missionFromRow(data);
  const received = await appendAiTeamMissionEvent(adminSupabase, {
    missionId: mission.id,
    createdBy: input.createdBy,
    phase: "intake",
    eventType: "received",
    status: "completed",
    summary: "Command received",
    detail: "The command was accepted by the mission engine.",
    ordinal: 0,
  });
  return { ...mission, events: [received] };
}

export async function updateAiTeamMissionLifecycle(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  missionId: string,
  status: AiTeamMissionStatus,
): Promise<AiTeamMission> {
  if (!MISSION_STATUSES.has(status) || TERMINAL_STATUSES.has(status)) {
    throw new Error("Invalid AI Team mission lifecycle status.");
  }
  const now = new Date().toISOString();
  const update: {
    status: AiTeamMissionStatus;
    updated_at: string;
    started_at?: string;
  } = { status, updated_at: now };
  if (status === "planning") update.started_at = now;
  let query = adminSupabase
    .from("ai_team_missions")
    .update(update)
    .eq("id", missionId)
    .eq("created_by", userId)
    .in("status", NON_TERMINAL_STATUSES);
  if (status !== "stopped") query = query.is("stop_requested_at", null);
  const { data, error } = await query.select("*").maybeSingle();
  if (error) {
    throw new Error("Unable to update AI Team mission lifecycle.", {
      cause: error,
    });
  }
  if (!data) return loadAiTeamMission(adminSupabase, userId, missionId);
  return missionFromRow(data);
}

export async function appendAiTeamMissionEvent(
  adminSupabase: BuxmeSupabaseClient,
  input: {
    missionId: string;
    createdBy: string;
    phase: string;
    eventType: string;
    agentId?: AiTeamAgentId;
    toolName?: string;
    status: AiTeamMissionEventStatus;
    summary: string;
    detail?: string;
    metadata?: Record<string, unknown>;
    ordinal: number;
  },
): Promise<AiTeamMissionEvent> {
  const phase = boundedText(input.phase, 80);
  const eventType = boundedText(input.eventType, 80);
  const summary = boundedText(input.summary, 160);
  if (
    !phase ||
    !eventType ||
    !summary ||
    !EVENT_STATUSES.has(input.status) ||
    input.ordinal < 0
  ) {
    throw new Error("Invalid AI Team mission event.");
  }
  const { data, error } = await adminSupabase
    .from("ai_team_mission_events")
    .insert({
      mission_id: input.missionId,
      created_by: input.createdBy,
      phase,
      event_type: eventType,
      agent_id: input.agentId ?? null,
      tool_name: input.toolName
        ? boundedText(input.toolName, 100)
        : null,
      status: input.status,
      summary,
      detail: input.detail ? boundedText(input.detail, 1000) : null,
      metadata: safeObject(input.metadata),
      ordinal: input.ordinal,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("Unable to append AI Team mission event.", {
      cause: error ?? undefined,
    });
  }
  return missionEventFromRow(data);
}

export async function attachAiTeamMissionRun(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  missionId: string,
  runId: string,
): Promise<void> {
  const { data: ownedRun, error: runError } = await adminSupabase
    .from("ai_team_runs")
    .select("id")
    .eq("id", runId)
    .eq("created_by", userId)
    .maybeSingle();
  if (runError || !ownedRun) {
    throw new Error("AI Team run is not owned by this admin.", {
      cause: runError ?? undefined,
    });
  }
  const { data, error } = await adminSupabase
    .from("ai_team_missions")
    .update({ run_id: runId, updated_at: new Date().toISOString() })
    .eq("id", missionId)
    .eq("created_by", userId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    throw new Error("Unable to attach the AI Team run to its mission.", {
      cause: error ?? undefined,
    });
  }
}

export async function addAiTeamMissionChange(
  adminSupabase: BuxmeSupabaseClient,
  input: {
    missionId: string;
    createdBy: string;
    targetType: string;
    targetRef: string;
    action: string;
    beforeSnapshot?: Record<string, unknown> | null;
    afterSnapshot?: Record<string, unknown> | null;
    summary: string;
    verified?: boolean;
  },
): Promise<AiTeamMissionChange> {
  const { data, error } = await adminSupabase
    .from("ai_team_mission_changes")
    .insert({
      mission_id: input.missionId,
      created_by: input.createdBy,
      target_type: boundedText(input.targetType, 60),
      target_ref: boundedText(input.targetRef, 500),
      action: boundedText(input.action, 80),
      before_snapshot: input.beforeSnapshot
        ? safeObject(input.beforeSnapshot)
        : null,
      after_snapshot: input.afterSnapshot
        ? safeObject(input.afterSnapshot)
        : null,
      summary: boundedText(input.summary, 500),
      verified: input.verified ?? false,
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("Unable to record AI Team mission change.", {
      cause: error ?? undefined,
    });
  }
  return missionChangeFromRow(data);
}

export async function addAiTeamMissionVerification(
  adminSupabase: BuxmeSupabaseClient,
  input: {
    missionId: string;
    createdBy: string;
    checkType: string;
    status: AiTeamVerificationStatus;
    summary: string;
    evidence?: Record<string, unknown>;
  },
): Promise<AiTeamMissionVerification> {
  if (!VERIFICATION_STATUSES.has(input.status)) {
    throw new Error("Invalid AI Team mission verification.");
  }
  const { data, error } = await adminSupabase
    .from("ai_team_mission_verifications")
    .insert({
      mission_id: input.missionId,
      created_by: input.createdBy,
      check_type: boundedText(input.checkType, 100),
      status: input.status,
      summary: boundedText(input.summary, 500),
      evidence: safeObject(input.evidence),
    })
    .select("*")
    .single();
  if (error || !data) {
    throw new Error("Unable to record AI Team mission verification.", {
      cause: error ?? undefined,
    });
  }
  return missionVerificationFromRow(data);
}

export async function listRecentAiTeamMissions(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  limit = 20,
): Promise<AiTeamMission[]> {
  const { data, error } = await adminSupabase
    .from("ai_team_missions")
    .select("*")
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .limit(Math.min(50, Math.max(1, limit)));
  if (error) {
    throw new Error("Unable to load recent AI Team missions.", { cause: error });
  }
  return data.map((row) => missionFromRow(row));
}

export async function loadAiTeamMission(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  missionId: string,
): Promise<AiTeamMission> {
  const [
    { data: mission, error: missionError },
    { data: events, error: eventsError },
    { data: changes, error: changesError },
    { data: verifications, error: verificationsError },
  ] = await Promise.all([
    adminSupabase
      .from("ai_team_missions")
      .select("*")
      .eq("id", missionId)
      .eq("created_by", userId)
      .maybeSingle(),
    adminSupabase
      .from("ai_team_mission_events")
      .select("*")
      .eq("mission_id", missionId)
      .eq("created_by", userId)
      .order("ordinal", { ascending: true }),
    adminSupabase
      .from("ai_team_mission_changes")
      .select("*")
      .eq("mission_id", missionId)
      .eq("created_by", userId)
      .order("created_at", { ascending: true }),
    adminSupabase
      .from("ai_team_mission_verifications")
      .select("*")
      .eq("mission_id", missionId)
      .eq("created_by", userId)
      .order("created_at", { ascending: true }),
  ]);
  if (
    missionError ||
    eventsError ||
    changesError ||
    verificationsError
  ) {
    throw new Error("Unable to load AI Team mission.", {
      cause:
        missionError ??
        eventsError ??
        changesError ??
        verificationsError ??
        undefined,
    });
  }
  if (!mission) throw new Error("AI Team mission not found.");
  return missionFromRow(
    mission,
    events.map(missionEventFromRow),
    changes.map(missionChangeFromRow),
    verifications.map(missionVerificationFromRow),
  );
}

export async function loadAiTeamMissionByOperation(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  operationId: string,
): Promise<AiTeamMission | null> {
  const { data, error } = await adminSupabase
    .from("ai_team_missions")
    .select("id")
    .eq("created_by", userId)
    .eq("operation_id", operationId)
    .maybeSingle();
  if (error) {
    throw new Error("Unable to load AI Team mission operation.", {
      cause: error,
    });
  }
  return data
    ? loadAiTeamMission(adminSupabase, userId, data.id)
    : null;
}

export async function isAiTeamMissionStopRequested(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  missionId: string,
): Promise<boolean> {
  const { data, error } = await adminSupabase
    .from("ai_team_missions")
    .select("status, stop_requested_at")
    .eq("id", missionId)
    .eq("created_by", userId)
    .maybeSingle();
  if (error || !data) {
    throw new Error("Unable to check AI Team mission stop state.", {
      cause: error ?? undefined,
    });
  }
  return data.status === "stopped" || Boolean(data.stop_requested_at);
}

export async function finalizeAiTeamMission(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  missionId: string,
  requestedStatus: Extract<
    AiTeamMissionStatus,
    "completed" | "partial" | "failed" | "stopped"
  >,
  run: AiTeamRun | null,
): Promise<AiTeamMission> {
  const mission = await loadAiTeamMission(adminSupabase, userId, missionId);
  if (TERMINAL_STATUSES.has(mission.status)) return mission;
  const checksPass =
    mission.verifications.some(
      (verification) => verification.status === "passed",
    ) &&
    mission.verifications.every(
      (verification) => verification.status !== "failed",
    );
  const status =
    mission.status === "stopped" || mission.stopRequestedAt
      ? "stopped"
      : requestedStatus === "completed" && !checksPass
        ? "partial"
        : requestedStatus;
  const completedAt = new Date();
  const startedAt = Date.parse(mission.startedAt ?? mission.createdAt);
  const elapsedMs = Math.max(0, completedAt.getTime() - startedAt);
  const report = buildAiTeamIntelligenceReport(
    mission,
    run,
    status,
    elapsedMs,
  );
  let query = adminSupabase
    .from("ai_team_missions")
    .update({
      status,
      completed_at: completedAt.toISOString(),
      elapsed_ms: elapsedMs,
      verified: status === "completed" && checksPass,
      final_report: report as unknown as Json,
      updated_at: completedAt.toISOString(),
    })
    .eq("id", missionId)
    .eq("created_by", userId)
    .in("status", NON_TERMINAL_STATUSES);
  if (status !== "stopped") query = query.is("stop_requested_at", null);
  const { data, error } = await query.select("*").maybeSingle();
  if (error) {
    throw new Error("Unable to finalize AI Team mission.", {
      cause: error,
    });
  }
  if (!data) return loadAiTeamMission(adminSupabase, userId, missionId);
  return missionFromRow(
    data,
    mission.events,
    mission.changes,
    mission.verifications,
  );
}

export async function requestAiTeamMissionStop(
  adminSupabase: BuxmeSupabaseClient,
  userId: string,
  missionId: string,
): Promise<AiTeamMission> {
  const mission = await loadAiTeamMission(adminSupabase, userId, missionId);
  if (TERMINAL_STATUSES.has(mission.status)) return mission;
  const completedAt = new Date();
  const now = completedAt.toISOString();
  const startedAt = Date.parse(mission.startedAt ?? mission.createdAt);
  const elapsedMs = Math.max(0, completedAt.getTime() - startedAt);
  const report = buildAiTeamIntelligenceReport(
    mission,
    null,
    "stopped",
    elapsedMs,
  );
  const { data, error } = await adminSupabase
    .from("ai_team_missions")
    .update({
      status: "stopped",
      stop_requested_at: now,
      completed_at: now,
      elapsed_ms: elapsedMs,
      verified: false,
      final_report: report as unknown as Json,
      updated_at: now,
    })
    .eq("id", missionId)
    .eq("created_by", userId)
    .in("status", NON_TERMINAL_STATUSES)
    .select("*")
    .maybeSingle();
  if (error) {
    throw new Error("Unable to request AI Team mission stop.", {
      cause: error,
    });
  }
  if (!data) return loadAiTeamMission(adminSupabase, userId, missionId);
  const stopEvent = await appendAiTeamMissionEvent(adminSupabase, {
    missionId,
    createdBy: userId,
    phase: "control",
    eventType: "stop_requested",
    status: "stopped",
    summary: "Stop requested",
    detail:
      "The server recorded the stop request. Work already running may take time to observe it.",
    ordinal: mission.events.reduce(
      (highest, event) => Math.max(highest, event.ordinal + 1),
      0,
    ),
  }).catch((eventError) => {
    console.error("[ai-team/missions] Stop event append failed", eventError);
    return null;
  });
  return missionFromRow(
    data,
    stopEvent ? [...mission.events, stopEvent] : mission.events,
    mission.changes,
    mission.verifications,
  );
}

export {
  missionChangeFromRow,
  missionEventFromRow,
  missionFromRow,
  missionVerificationFromRow,
};
