import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260913_ai_team_activity_stream.sql",
    import.meta.url,
  ),
  "utf8",
);

for (const invariant of [
  "ai_team_activity_events",
  "operation_id uuid NOT NULL",
  "created_by uuid NOT NULL",
  "REFERENCES public.ai_team_runs (id) ON DELETE SET NULL",
  "UNIQUE (created_by, operation_id, ordinal)",
  "ENABLE ROW LEVEL SECURITY",
  "FROM PUBLIC, anon, authenticated, service_role",
  "GRANT SELECT, INSERT, UPDATE ON public.ai_team_activity_events TO service_role",
]) {
  assert.ok(migration.includes(invariant), `V4 migration must include ${invariant}`);
}
for (const status of ["pending", "running", "completed", "warning", "failed"]) {
  assert.ok(migration.includes(`'${status}'`), `Missing activity status ${status}`);
}
for (const agent of [
  "chief_of_staff",
  "engineering",
  "qa",
  "analytics",
  "product",
  "growth",
  "customer",
  "critic",
]) {
  assert.ok(migration.includes(`'${agent}'`), `Missing activity agent ${agent}`);
}

const postRoute = await readFile(
  new URL("../app/api/admin/ai-team/route.ts", import.meta.url),
  "utf8",
);
assert.ok(postRoute.includes("operationId?: unknown"));
assert.ok(postRoute.includes("const operationId = suppliedOperationId ?? randomUUID()"));
assert.ok(postRoute.includes("createAiTeamPlan("));
assert.ok(postRoute.includes("recordActivity"));
assert.ok(postRoute.includes("request.signal"));
assert.ok(postRoute.includes("attachAiTeamActivityRun"));
assert.ok(postRoute.includes("operationId,"));
assert.ok(postRoute.includes("operationId has already been used."));
assert.ok(postRoute.includes("Activity write failed"));

const activityRoute = await readFile(
  new URL("../app/api/admin/ai-team/activity/route.ts", import.meta.url),
  "utf8",
);
assert.ok(activityRoute.includes("requireAdminApiUser()"));
assert.ok(activityRoute.includes("listAiTeamActivity("));
assert.ok(activityRoute.includes("listAiTeamActivityByRun("));
assert.ok(activityRoute.includes("runId"));

const activityService = await readFile(
  new URL("../lib/ai-team/activity.ts", import.meta.url),
  "utf8",
);
assert.ok(activityService.includes('.eq("created_by", userId)'));
assert.ok(activityService.includes('.eq("operation_id", operationId)'));
assert.ok(activityService.includes('.eq("run_id", runId)'));
assert.ok(activityService.includes('.order("ordinal", { ascending: true })'));

const runHistory = await readFile(
  new URL("../lib/ai-team/runHistory.ts", import.meta.url),
  "utf8",
);
assert.ok(runHistory.includes('.eq("created_by", userId)'));

const activityTypes = await readFile(
  new URL("../lib/ai-team/types.ts", import.meta.url),
  "utf8",
);
const progressType = activityTypes.match(
  /export type AiTeamProgressEvent = \{([\s\S]*?)\n\};/,
)?.[1];
assert.ok(progressType, "AiTeamProgressEvent must be declared");
for (const privateField of ["reasoning", "thoughts", "prompt", "rawOutput"]) {
  assert.ok(
    !progressType.includes(privateField),
    `Progress callback must not expose ${privateField}`,
  );
}

const runtime = await readFile(
  new URL("../lib/ai-team/modelRuntime.ts", import.meta.url),
  "utf8",
);
assert.ok(runtime.includes("onProgress?: AiTeamProgressCallback"));
assert.ok(runtime.includes("PRIVATE_REASONING_PATTERN"));
assert.ok(runtime.includes("Private reasoning content was withheld"));
assert.ok(runtime.includes("system[- ]prompt"));
assert.ok(
  runtime.includes("summary: conciseOutputText(result.output.summary, 800)"),
  "Persisted Chief summary must pass through the safe text filter",
);
for (const milestone of [
  "Agents routed",
  "active",
  "Critic reviewing",
  "Chief synthesizing",
  "fallback",
]) {
  assert.ok(runtime.includes(milestone), `Missing runtime milestone ${milestone}`);
}
const safeFormatterStart = runtime.indexOf(
  "export function formatCompletedAgentOutput(",
);
const safeFormatterEnd = runtime.indexOf(
  "async function emitProgress",
  safeFormatterStart,
);
assert.ok(
  safeFormatterStart >= 0 && safeFormatterEnd > safeFormatterStart,
  "Completed model outputs must use a safe formatter",
);
const safeFormatter = runtime.slice(safeFormatterStart, safeFormatterEnd);
for (const safeField of ["output.summary", "recommendations", "tasks"]) {
  assert.ok(
    safeFormatter.includes(safeField),
    `Safe activity detail must intentionally include ${safeField}`,
  );
}
assert.ok(
  safeFormatter.includes(".slice(0, 1000)"),
  "Safe activity detail must remain bounded to 1000 characters",
);
for (const privateField of ["reasoning", "thoughts", "prompt", "rawOutput"]) {
  assert.ok(
    !safeFormatter.includes(privateField),
    `Safe activity formatter must not expose ${privateField}`,
  );
}
for (const includedSummary of [
  "summary: generation.output.summary",
  "summary: criticResult.output.summary",
  "summary: result.output.summary",
]) {
  assert.ok(
    runtime.includes(includedSummary),
    `Completed activity must intentionally include ${includedSummary}`,
  );
}

const adminSection = await readFile(
  new URL("../components/admin/AdminAiTeamSection.tsx", import.meta.url),
  "utf8",
);
assert.ok(adminSection.includes("/api/admin/ai-team/activity?runId="));
assert.ok(adminSection.includes("restoredActivityRunId"));

const commandUi = await readFile(
  new URL(
    "../components/admin/ai-team/CommandCenterV4.tsx",
    import.meta.url,
  ),
  "utf8",
);
assert.ok(
  commandUi.includes("Operational trace — no hidden reasoning is displayed."),
);
assert.ok(commandUi.includes("BUXME INTELLIGENCE CORE"));
assert.ok(commandUi.includes("MISSION DEBRIEF"));
assert.ok(commandUi.includes("FINAL DIRECTIVE"));
assert.ok(commandUi.includes("Awaiting agent reports"));
assert.ok(commandUi.includes("This is what the team recommends"));
assert.ok(commandUi.includes("crypto") === false);

const ownershipMigration = await readFile(
  new URL(
    "../supabase/migrations/20260914_ai_team_user_scope_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);
for (const invariant of [
  "ai_team_founder_briefs_generated_by_date_key",
  "v_run_owner IS DISTINCT FROM p_actor_id",
  "v_run.created_by IS DISTINCT FROM p_created_by",
  "actor_id = p_created_by",
]) {
  assert.ok(
    ownershipMigration.includes(invariant),
    `Ownership hardening migration must include ${invariant}`,
  );
}

const executionService = await readFile(
  new URL("../lib/ai-team/executionPackets.ts", import.meta.url),
  "utf8",
);
assert.ok(executionService.includes('.eq("created_by", userId)'));
assert.ok(executionService.includes('.eq("created_by", userId)') || executionService.includes("created_by"));

const founderBriefService = await readFile(
  new URL("../lib/ai-team/founderBrief.ts", import.meta.url),
  "utf8",
);
assert.ok(founderBriefService.includes('.eq("generated_by", userId)'));
assert.ok(founderBriefService.includes('onConflict: "generated_by,brief_date"'));

const healthRoute = await readFile(
  new URL("../app/api/health/ai-team/route.ts", import.meta.url),
  "utf8",
);
assert.ok(
  /version:\s*"5\.[0-9]+\.[0-9]+"/.test(healthRoute),
  "V4 compatibility test requires a V5.x health contract",
);
assert.ok(healthRoute.includes("liveActivityTrace"));

for (const source of [postRoute, activityRoute, activityService, commandUi]) {
  assert.ok(!source.includes("child_process"), "V4 must not execute shell commands");
  assert.ok(!source.includes("stripe."), "V4 must not execute Stripe operations");
  assert.ok(!source.includes("vercel deploy"), "V4 must not deploy");
}

console.log("✅ AI Team V4 invariant checks passed.");
