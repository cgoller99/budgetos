import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  migration,
  fkIndexMigration,
  service,
  report,
  postRoute,
  missionsRoute,
  commandCenter,
  browserInterfaces,
  capabilities,
  health,
  types,
  adminSection,
  operationControl,
  modelRuntime,
] = await Promise.all([
  read("supabase/migrations/20260915_buxme_os_v5_mission_engine.sql"),
  read("supabase/migrations/20260916_buxme_os_v5_mission_fk_indexes.sql"),
  read("lib/ai-team/missions.ts"),
  read("lib/ai-team/missionReports.ts"),
  read("app/api/admin/ai-team/route.ts"),
  read("app/api/admin/ai-team/missions/route.ts"),
  read("components/admin/ai-team/CommandCenterV5.tsx"),
  read("components/admin/ai-team/browserInterfaces.ts"),
  read("lib/ai-team/capabilities.ts"),
  read("app/api/health/ai-team/route.ts"),
  read("lib/ai-team/types.ts"),
  read("components/admin/AdminAiTeamSection.tsx"),
  read("lib/ai-team/operationControl.ts"),
  read("lib/ai-team/modelRuntime.ts"),
]);

for (const table of [
  "ai_team_missions",
  "ai_team_mission_events",
  "ai_team_mission_changes",
  "ai_team_mission_verifications",
]) {
  assert.ok(migration.includes(`public.${table}`), `Missing ${table}`);
}
assert.equal(
  migration.match(/ENABLE ROW LEVEL SECURITY/g)?.length,
  4,
  "Every V5 mission table must enable RLS",
);
assert.equal(
  migration.match(/FROM PUBLIC, anon, authenticated, service_role/g)?.length,
  4,
  "Every V5 table must revoke client and default service-role privileges",
);
assert.ok(migration.includes("FOREIGN KEY (mission_id, created_by)"));
assert.ok(migration.includes("GRANT SELECT, INSERT, UPDATE ON public.ai_team_missions TO service_role"));
for (const status of [
  "received",
  "planning",
  "running",
  "waiting_approval",
  "verifying",
  "completed",
  "partial",
  "failed",
  "stopped",
]) {
  assert.ok(migration.includes(`'${status}'`), `Missing mission status ${status}`);
}
for (const indexName of [
  "ai_team_mission_events_mission_owner_idx",
  "ai_team_mission_changes_mission_owner_idx",
  "ai_team_mission_verifications_mission_owner_idx",
]) {
  assert.ok(
    fkIndexMigration.includes(indexName),
    `Missing V5 composite FK covering index ${indexName}`,
  );
}
assert.ok(
  fkIndexMigration.includes("(mission_id, created_by)"),
  "V5 child mission tables must index the composite FK in parent-key order",
);

for (const level of ["observe", "assist", "act", "autopilot"]) {
  assert.ok(migration.includes(`'${level}'`), `Missing autonomy level ${level}`);
}

for (const scopedQuery of [
  '.eq("created_by", userId)',
  "created_by: input.createdBy",
]) {
  assert.ok(service.includes(scopedQuery), `Missing owner scope ${scopedQuery}`);
}
for (const method of [
  "createAiTeamMission",
  "updateAiTeamMissionLifecycle",
  "appendAiTeamMissionEvent",
  "attachAiTeamMissionRun",
  "addAiTeamMissionChange",
  "addAiTeamMissionVerification",
  "finalizeAiTeamMission",
  "listRecentAiTeamMissions",
  "loadAiTeamMission",
  "requestAiTeamMissionStop",
]) {
  assert.ok(service.includes(`function ${method}`), `Missing service method ${method}`);
}
assert.ok(service.includes("FORBIDDEN_STORAGE_KEY"));
for (const forbidden of [
  '"rawoutput"',
  '"chainofthought"',
  '"prompt"',
  "reasoning",
  "secret",
  "credential",
  '"token"',
  '"screenshot"',
]) {
  assert.ok(service.includes(forbidden), `Storage filter must block ${forbidden}`);
}
assert.ok(service.includes('key.replace(/[^a-z0-9]/gi, "").toLowerCase()'));
for (const sensitiveValueFilter of [
  "PRIVATE_STORAGE_VALUE",
  "BEARER_CREDENTIAL",
  "JWT_CREDENTIAL",
  "API_KEY_CREDENTIAL",
  "PREFIXED_CREDENTIAL",
  "DATA_URL",
  "REDACTED_STORAGE_VALUE",
]) {
  assert.ok(
    service.includes(sensitiveValueFilter),
    `Storage values must apply ${sensitiveValueFilter}`,
  );
}
assert.ok(
  service.includes("command = boundedText(input.command, 1000)"),
  "The explicit founder-authored command must remain persisted",
);

for (const section of [
  "command:",
  "status,",
  "elapsedTimeMs:",
  "agentsUsed:",
  "whatWasRequested:",
  "whatTheTeamDid:",
  "whatItFound:",
  "whatChanged:",
  "filesDataActionsAffected:",
  "importantFindings:",
  "warnings:",
  "whatCouldNotBeCompleted:",
  "verificationResults:",
  "recommendedNextActions:",
]) {
  assert.ok(report.includes(section), `Report missing ${section}`);
}
assert.ok(report.includes('const NO_CHANGES = "No changes were made."'));
assert.ok(report.includes("? [NO_CHANGES]"));
assert.ok(report.includes("AI model runtime was unavailable or did not complete"));
assert.ok(service.includes('requestedStatus === "completed" && !checksPass'));
assert.ok(service.includes('verified: status === "completed" && checksPass'));
assert.ok(
  service.includes('.in("status", NON_TERMINAL_STATUSES)'),
  "Lifecycle and terminal writes must be conditional on non-terminal state",
);
assert.ok(
  service.includes(
    "if (!MISSION_STATUSES.has(status) || TERMINAL_STATUSES.has(status))",
  ),
  "Lifecycle updates must not bypass verified terminal finalization",
);
assert.ok(
  service.includes(
    "if (!data) return loadAiTeamMission(adminSupabase, userId, missionId)",
  ),
  "A lost terminal race must reload the persisted mission",
);
assert.ok(
  service.includes('if (status !== "stopped") query = query.is("stop_requested_at", null)'),
  "Non-stop finalization must not pass a persisted stop request",
);

for (const verification of [
  "run_persisted",
  "tasks_persisted",
  "operational_trace_linked",
  "approval_requirements_represented",
]) {
  assert.ok(postRoute.includes(verification), `Missing ${verification} check`);
}
assert.ok(postRoute.includes("createAiTeamMission"));
assert.ok(postRoute.includes("mission: completedMission"));
assert.ok(postRoute.includes("No changes were made."));
assert.ok(postRoute.includes("mode: plan.source"));
assert.ok(postRoute.includes("observeMissionStop"));
assert.ok(postRoute.includes("isAiTeamOperationStopRequested"));
assert.ok(
  postRoute.indexOf("const stoppedMission = await observeMissionStop(") >
    postRoute.indexOf("mission = await createAiTeamMission("),
  "POST must check durable operation stops immediately after mission creation",
);
assert.ok(
  postRoute.indexOf("const stoppedMission = await observeMissionStop(") <
    postRoute.indexOf("await recordPlanStart("),
  "POST must observe stops before planning is recorded or started",
);
assert.ok(
  operationControl.includes("operationStopRequestId(userId, operationId)"),
);
assert.ok(operationControl.includes('"AI Team mission stop requested"'));
assert.ok(operationControl.includes('.eq("user_id", userId)'));

assert.ok(missionsRoute.includes("requireAdminApiUser()"));
assert.ok(missionsRoute.includes("UUID_PATTERN"));
assert.ok(missionsRoute.includes("Cache-Control"));
assert.ok(missionsRoute.includes("requestAiTeamMissionStop"));

for (const browserApi of [
  "SpeechRecognition",
  "webkitSpeechRecognition",
  "speechSynthesis",
  "getUserMedia",
  "getDisplayMedia",
  "getTracks().forEach((track) => track.stop())",
  "AbortController",
]) {
  assert.ok(
    browserInterfaces.includes(browserApi) ||
      commandCenter.includes(browserApi) ||
      adminSection.includes(browserApi) ||
      postRoute.includes(browserApi),
    `Missing browser/control API ${browserApi}`,
  );
}
assert.ok(commandCenter.includes("MIC ACTIVE"));
assert.ok(commandCenter.includes("Screen OFF"));
assert.ok(commandCenter.includes("EMERGENCY STOP"));
assert.ok(adminSection.includes("missionAbortController.current?.abort()"));
assert.ok(adminSection.includes("commandOverride?: string"));
assert.ok(adminSection.includes("void createPlan(context, commandOverride)"));
assert.ok(missionsRoute.includes("operationId?: unknown"));
assert.ok(browserInterfaces.includes("setCapturedFrame(null)"));
assert.ok(commandCenter.includes("Auto-submit after speech (off by default)"));
assert.ok(commandCenter.includes("The AI has not analyzed your screen."));
assert.ok(commandCenter.includes("No unrestricted executor"));
assert.ok(commandCenter.includes("requestFullscreen"));
assert.ok(
  commandCenter.includes(
    "Browser Web Speech implementations may process audio or transcripts",
  ),
);
assert.ok(
  commandCenter.includes("Buxme does not persist") &&
    commandCenter.includes("microphone audio in this release."),
);

for (const contract of [
  "user-facing FINAL CONCLUSION only",
  "Never include chain-of-thought",
  "without narrating internal reasoning",
]) {
  assert.ok(modelRuntime.includes(contract), `Missing final-output safety contract: ${contract}`);
}
assert.ok(modelRuntime.includes("modelAbortSignal"));
assert.ok(modelRuntime.includes("AbortSignal.any"));
const fallbackSections = modelRuntime.split("return {").filter((section) =>
  section.includes("fallbackPlan(goal, snapshot)"),
);
assert.equal(fallbackSections.length, 2);
assert.equal(
  (
    modelRuntime.match(
      /throwIfMissionAborted\(abortSignal\);\s+return \{\s+\.\.\.fallbackPlan/g,
    ) ?? []
  ).length,
  2,
  "Every fallback path must re-check abort immediately before returning",
);

const activeGuard = postRoute.indexOf("if (activePlanningUsers.has(userId))");
const cooldownGuard = postRoute.indexOf("if (now - lastStartedAt");
const capacityGuard = postRoute.indexOf("await hasDailyPlanCapacity");
const lockGuard = postRoute.indexOf("distributedLeaseId = await claimPlanLock");
const reservation = postRoute.indexOf(
  "operationReserved = await reserveOperationId",
);
assert.ok(
  [activeGuard, cooldownGuard, capacityGuard, lockGuard].every(
    (guard) => guard >= 0 && guard < reservation,
  ),
  "Active, cooldown, capacity, and lock guards must precede reservation",
);
assert.ok(postRoute.includes("if (operationReserved && !mission)"));
assert.ok(postRoute.includes("mission = await loadAiTeamMissionByOperation("));
assert.ok(postRoute.includes("await releaseOperationId("));
const releaseOperationStart = postRoute.indexOf(
  "async function releaseOperationId(",
);
const releaseOperationEnd = postRoute.indexOf(
  "async function observeMissionStop(",
);
const releaseOperation = postRoute.slice(
  releaseOperationStart,
  releaseOperationEnd,
);
for (const exactReservationFilter of [
  "operationReservationId(userId, operationId)",
  '.eq("event_type", "ai_team")',
  '.eq("message", "AI Team operation reserved")',
  '.eq("user_id", userId)',
  '.contains("metadata", { operationId })',
]) {
  assert.ok(
    releaseOperation.includes(exactReservationFilter),
    `Reservation release must include ${exactReservationFilter}`,
  );
}

for (const risk of [
  "read",
  "normal_write",
  "sensitive_write",
  "destructive",
  "external",
  "financial",
  "security",
]) {
  assert.ok(types.includes(`"${risk}"`), `Missing risk class ${risk}`);
}
for (const blockedCapability of [
  "filesystem-shell",
  "external-publishing",
  "payments",
  "security-control",
]) {
  const start = capabilities.indexOf(`id: "${blockedCapability}"`);
  assert.ok(start >= 0);
  assert.ok(
    capabilities.slice(start, start + 500).includes("available: false"),
    `${blockedCapability} must be unavailable`,
  );
}

assert.ok(
  /version:\s*"5\.[0-9]+\.[0-9]+"/.test(health),
  "V5 compatibility test requires a V5.x health contract",
);
for (const feature of [
  "missionEngine",
  "voiceInterface",
  "screenPermissionShell",
  "autonomyPolicy",
  "intelligenceReports",
  "approvedExecution",
  "liveActivityTrace",
]) {
  assert.ok(health.includes(feature), `Missing health feature ${feature}`);
}

for (const source of [
  service,
  report,
  postRoute,
  missionsRoute,
  commandCenter,
  browserInterfaces,
  capabilities,
]) {
  assert.ok(!source.includes("child_process"), "V5 must not execute shell commands");
  assert.ok(!source.includes("vercel deploy"), "V5 must not deploy");
  assert.ok(!source.includes("stripe."), "V5 must not execute payments");
}

console.log("✅ AI Team V5.1 mission-engine invariant checks passed.");
