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
assert.ok(postRoute.includes("createAiTeamPlan(goal, snapshot, recordActivity)"));
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

const activityService = await readFile(
  new URL("../lib/ai-team/activity.ts", import.meta.url),
  "utf8",
);
assert.ok(activityService.includes('.eq("created_by", userId)'));
assert.ok(activityService.includes('.eq("operation_id", operationId)'));
assert.ok(activityService.includes('.order("ordinal", { ascending: true })'));

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
for (const milestone of [
  "Agents routed",
  "active",
  "Critic reviewing",
  "Chief synthesizing",
  "fallback",
]) {
  assert.ok(runtime.includes(milestone), `Missing runtime milestone ${milestone}`);
}

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
assert.ok(commandUi.includes("crypto") === false);

const healthRoute = await readFile(
  new URL("../app/api/health/ai-team/route.ts", import.meta.url),
  "utf8",
);
assert.ok(healthRoute.includes('version: "4.0.0"'));
assert.ok(healthRoute.includes("liveActivityTrace"));

for (const source of [postRoute, activityRoute, activityService, commandUi]) {
  assert.ok(!source.includes("child_process"), "V4 must not execute shell commands");
  assert.ok(!source.includes("stripe."), "V4 must not execute Stripe operations");
  assert.ok(!source.includes("vercel deploy"), "V4 must not deploy");
}

console.log("✅ AI Team V4 invariant checks passed.");
