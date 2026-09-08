import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  evidenceAvailability,
  launchReadinessScore,
  operatingHealthScore,
  operatingSuggestions,
} from "../lib/ai-team/intelligence.ts";

const snapshot = {
  generatedAt: new Date().toISOString(),
  overview: null,
  revenue: null,
  plaid: null,
  analytics: null,
  health: [],
  observations: [],
  unavailableSources: ["overview", "revenue", "plaid", "analytics", "health"],
};

assert.deepEqual(evidenceAvailability(snapshot), {
  overview: false,
  revenue: false,
  plaid: false,
  analytics: false,
  health: false,
});
assert.equal(operatingHealthScore(snapshot).score, 20);
assert.equal(launchReadinessScore(snapshot, [], []).score, 20);
assert.ok(operatingSuggestions(snapshot, []).length >= 3);
assert.ok(operatingSuggestions(snapshot, []).length <= 6);

const migration = await readFile(
  new URL("../supabase/migrations/20260910_ai_team_v2.sql", import.meta.url),
  "utf8",
);
for (const required of [
  "ai_team_approval_decisions",
  "ai_team_playbooks",
  "runtime_metadata",
  "SECURITY INVOKER",
  "ENABLE ROW LEVEL SECURITY",
  "record_ai_team_approval_decision",
  "FOR UPDATE",
  "SET status = p_decision",
  "GRANT SELECT, INSERT ON public.ai_team_approval_decisions TO service_role",
  "'approved'",
  "'rejected'",
]) {
  assert.ok(migration.includes(required), `Migration must include ${required}`);
}
assert.match(
  migration,
  /REVOKE ALL ON public\.ai_team_approval_decisions FROM service_role/,
  "Service role must not be able to mutate or truncate decisions directly",
);

const hardeningMigration = await readFile(
  new URL(
    "../supabase/migrations/20260911_ai_team_v2_hardening.sql",
    import.meta.url,
  ),
  "utf8",
);
assert.ok(
  hardeningMigration.includes(
    "REVOKE EXECUTE ON FUNCTION public.prevent_ai_team_decision_mutation()",
  ),
);
assert.ok(
  hardeningMigration.includes(
    "ai_team_playbooks_created_by_favorite_updated_idx",
  ),
);

const healthRoute = await readFile(
  new URL("../app/api/health/ai-team/route.ts", import.meta.url),
  "utf8",
);
for (const field of [
  'version: "2.0.0"',
  "persistenceConfigured",
  "runtimeConfigured",
  "ready",
]) {
  assert.ok(healthRoute.includes(field), `Health endpoint must include ${field}`);
}
assert.ok(healthRoute.includes("ok: ready"));
assert.ok(healthRoute.includes("status: ready ? 200 : 503"));

const modelRuntime = await readFile(
  new URL("../lib/ai-team/modelRuntime.ts", import.meta.url),
  "utf8",
);
assert.ok(modelRuntime.includes("getVercelOidcTokenSync"));
assert.ok(!modelRuntime.includes("process.env.VERCEL)"));
assert.ok(modelRuntime.includes("specialistAbortController.signal"));
assert.ok(modelRuntime.includes("specialistAbortController.abort(error)"));
assert.ok(modelRuntime.includes("completedGenerations"));

const approvalRoute = await readFile(
  new URL("../app/api/admin/ai-team/approvals/route.ts", import.meta.url),
  "utf8",
);
assert.ok(approvalRoute.includes('.rpc("record_ai_team_approval_decision"'));
assert.ok(!approvalRoute.includes('.from("ai_team_approval_decisions").insert'));
assert.ok(approvalRoute.includes("executed: false"));

const playbookRoute = await readFile(
  new URL("../app/api/admin/ai-team/playbooks/route.ts", import.meta.url),
  "utf8",
);
assert.equal(
  playbookRoute.match(/\.eq\("created_by", auth\.user\.id\)/g)?.length,
  2,
  "Playbook update and delete must be scoped to the current admin",
);

const operations = await readFile(
  new URL("../lib/ai-team/operations.ts", import.meta.url),
  "utf8",
);
assert.ok(operations.includes('.eq("created_by", createdBy)'));

const playbookUi = await readFile(
  new URL("../components/admin/ai-team/Playbooks.tsx", import.meta.url),
  "utf8",
);
assert.ok(playbookUi.includes('title="Delete custom playbook?"'));

const playbooks = await readFile(
  new URL("../components/admin/ai-team/shared.tsx", import.meta.url),
  "utf8",
);
for (const title of [
  "Launch Risk",
  "Plaid Health",
  "Onboarding Conversion",
  "Release QA",
  "Growth Experiment",
  "Support Themes",
  "Subscription Health",
  "iOS Purchase QA",
]) {
  assert.ok(playbooks.includes(`title: "${title}"`), `Missing playbook ${title}`);
}

console.log("✅ AI Team V2 invariant checks passed.");
