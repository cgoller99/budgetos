import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  deriveRevenueIntelligence,
  summarizeCustomerVoice,
} from "../lib/ai-team/v3Math.ts";

const migration = await readFile(
  new URL("../supabase/migrations/20260912_ai_team_v3.sql", import.meta.url),
  "utf8",
);
for (const invariant of [
  "ai_team_execution_packets",
  "ai_team_founder_briefs",
  "ENABLE ROW LEVEL SECURITY",
  "FROM PUBLIC, anon, authenticated",
  "requires_external_operator",
  "stage_ai_team_execution_packet",
  "SECURITY DEFINER",
  "GRANT SELECT ON public.ai_team_execution_packets TO service_role",
  "FOR UPDATE",
  "v_decision.decision <> 'approved'",
  "v_task.status <> 'approved'",
  "task_snapshot",
  "run_snapshot",
  "approval_snapshot",
  "proposed_branch_name",
  "implementation_brief",
  "validation_checklist",
  "rollback_notes",
]) {
  assert.ok(migration.includes(invariant), `V3 migration must include ${invariant}`);
}
assert.match(
  migration,
  /task_id uuid NOT NULL UNIQUE/,
  "Only one execution packet may exist per task",
);
assert.ok(
  migration.indexOf("v_decision.decision <> 'approved'") <
    migration.indexOf("INSERT INTO public.ai_team_execution_packets"),
  "The RPC must verify immutable approval before staging",
);

const executionRoute = await readFile(
  new URL("../app/api/admin/ai-team/execution/route.ts", import.meta.url),
  "utf8",
);
const executionUi = await readFile(
  new URL("../components/admin/ai-team/ExecutionCenter.tsx", import.meta.url),
  "utf8",
);
for (const source of [executionRoute, executionUi]) {
  assert.ok(source.includes("No action executed by Mission Control."));
}
assert.ok(executionRoute.includes("executed: false"));
assert.ok(executionRoute.includes("candidates"));
assert.ok(executionRoute.includes("listAiTeamExecutionCandidates"));
assert.ok(!executionRoute.includes("stripe."));
assert.ok(!executionRoute.includes("deploy"));
assert.ok(
  !migration.includes(
    "GRANT SELECT, INSERT ON public.ai_team_execution_packets TO service_role",
  ),
  "Service role must not be able to bypass approval by inserting execution packets directly",
);

const reports = [
  {
    id: "b",
    userId: null,
    userEmail: null,
    userName: null,
    reportType: "bug",
    message: "Plaid bank sync is slow and my balance is wrong",
    category: "Banking",
    screenshotUrl: null,
    recordingUrl: null,
    browser: "Safari",
    device: "iPhone",
    appVersion: "3.0.0",
    pagePath: "/accounts",
    status: "new",
    priority: "high",
    createdAt: "2026-09-08T12:00:00.000Z",
    updatedAt: "2026-09-08T12:00:00.000Z",
  },
  {
    id: "a",
    userId: null,
    userEmail: null,
    userName: null,
    reportType: "feedback",
    message: "The reports chart is useful",
    category: "Reports",
    screenshotUrl: null,
    recordingUrl: null,
    browser: "Chrome",
    device: "Desktop",
    appVersion: "3.0.0",
    pagePath: "/reports",
    status: "planned",
    priority: "normal",
    createdAt: "2026-09-07T12:00:00.000Z",
    updatedAt: "2026-09-07T12:00:00.000Z",
  },
];
const fixedNow = new Date("2026-09-08T14:00:00.000Z");
assert.deepEqual(
  summarizeCustomerVoice(reports, fixedNow),
  summarizeCustomerVoice([...reports].reverse(), fixedNow),
  "Customer Voice must be deterministic regardless of input order",
);

const revenue = deriveRevenueIntelligence(
  {
    available: true,
    mrr: 229.8,
    arr: 2757.6,
    freeUsers: 100,
    proUsers: 10,
    proPlusUsers: 10,
    churnRate: 4.8,
    newSubscriptions: 3,
    cancellations: 1,
    failedPayments: 2,
  },
  { pro: 7.99, proPlus: 14.99 },
  [1_000],
);
assert.equal(revenue.paidUsers, 20);
assert.equal(revenue.arpu, 11.49);
assert.equal(revenue.freeToPaidRatio, 0.2);
assert.equal(revenue.projections[0].blendedCustomersNeeded, 68);

const noDenominator = deriveRevenueIntelligence(
  {
    available: false,
    mrr: 0,
    arr: 0,
    freeUsers: 0,
    proUsers: 0,
    proPlusUsers: 0,
    churnRate: 0,
    newSubscriptions: 0,
    cancellations: 0,
    failedPayments: 0,
  },
  { pro: 7.99, proPlus: 14.99 },
);
assert.equal(noDenominator.arpu, null);
assert.equal(noDenominator.freeToPaidRatio, null);

const analyticsService = await readFile(
  new URL("../lib/ai-team/productAnalytics.ts", import.meta.url),
  "utf8",
);
assert.ok(analyticsService.includes('status: "missing_config"'));
assert.ok(analyticsService.includes('state: "missing"'));
assert.ok(analyticsService.includes("denominator > 0"));
assert.match(
  analyticsService,
  /checkoutCount !== null\s*&&\s*checkoutCount > 0\s*&&\s*purchasedCount !== null/,
);

const briefService = await readFile(
  new URL("../lib/ai-team/founderBrief.ts", import.meta.url),
  "utf8",
);
for (const section of [
  "whatChanged",
  "revenue",
  "product",
  "customers",
  "reliability",
  "decisionsWaiting",
  "executionReadyWork",
  "topPriorities",
  "risks",
  "missingEvidence",
]) {
  assert.ok(briefService.includes(`"${section}"`) || briefService.includes(`${section}:`));
}

const health = await readFile(
  new URL("../app/api/health/ai-team/route.ts", import.meta.url),
  "utf8",
);
assert.ok(health.includes("version:"));
assert.ok(health.includes("ai_team_execution_packets"));
assert.ok(health.includes("ai_team_founder_briefs"));

console.log("✅ AI Team V3 invariant checks passed.");
