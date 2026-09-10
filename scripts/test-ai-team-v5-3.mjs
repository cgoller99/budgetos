import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  autonomyAllowsAiTeamAction,
  detectAiTeamActionCommand,
  getAiTeamActionDefinition,
} from "../lib/ai-team/actionCommands.ts";

const read = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  actionCommands,
  actionRuntime,
  actionRoute,
  commandCenter,
  adminSection,
  capabilities,
  missionReports,
  health,
  briefRuntime,
  briefRoute,
  types,
] = await Promise.all([
  read("lib/ai-team/actionCommands.ts"),
  read("lib/ai-team/actionRuntime.ts"),
  read("app/api/admin/ai-team/actions/route.ts"),
  read("components/admin/ai-team/CommandCenterV5.tsx"),
  read("components/admin/AdminAiTeamSection.tsx"),
  read("lib/ai-team/capabilities.ts"),
  read("lib/ai-team/missionReports.ts"),
  read("app/api/health/ai-team/route.ts"),
  read("lib/ai-team/founderBriefRuntime.ts"),
  read("app/api/admin/ai-team/brief/route.ts"),
  read("lib/ai-team/types.ts"),
]);
assert.ok(actionCommands.includes('key: "intelligence.refresh"'));
assert.ok(actionCommands.includes('minimumAutonomy: "observe"'));
assert.ok(actionCommands.includes('key: "founder_brief.generate"'));
assert.ok(actionCommands.includes('minimumAutonomy: "act"'));
assert.ok(actionCommands.includes("detectAiTeamActionCommand"));
assert.ok(actionCommands.includes("^"));
assert.ok(actionCommands.includes("$"));
assert.equal(
  (actionCommands.match(/key: "[a-z_.]+"/g) ?? []).length,
  4,
  "V5.3 should expose exactly two definitions and two exact command mappings",
);
assert.ok(actionCommands.includes("autonomyAllowsAiTeamAction"));

for (const [command, expected] of [
  ["refresh intelligence", "intelligence.refresh"],
  ["please update buxme snapshot.", "intelligence.refresh"],
  ["generate founder brief", "founder_brief.generate"],
  ["please regenerate the founder brief.", "founder_brief.generate"],
  ["delete all users", null],
  ["send money", null],
  ["deploy production", null],
]) {
  assert.equal(detectAiTeamActionCommand(command), expected, command);
}
const founderBriefAction = getAiTeamActionDefinition("founder_brief.generate");
assert.equal(autonomyAllowsAiTeamAction("assist", founderBriefAction), false);
assert.equal(autonomyAllowsAiTeamAction("act", founderBriefAction), true);

assert.ok(actionRuntime.includes("executeAiTeamRegisteredAction"));
assert.ok(actionRuntime.includes("getAiTeamSnapshot"));
assert.ok(actionRuntime.includes("getAiTeamProductAnalytics"));
assert.ok(actionRuntime.includes("getAiTeamRevenueIntelligence"));
assert.ok(actionRuntime.includes("getAiTeamCustomerVoice"));
assert.ok(actionRuntime.includes("saveAiTeamFounderBrief"));
assert.ok(actionRuntime.includes("getLatestAiTeamFounderBrief"));
assert.ok(actionRuntime.includes("verificationPassed"));
assert.ok(actionRuntime.includes("refreshedSnapshot: input.snapshot"));

assert.ok(actionRoute.includes('export const runtime = "nodejs"'));
assert.ok(actionRoute.includes("requireAdminApiUser()"));
assert.ok(actionRoute.includes('"Cache-Control": "no-store, max-age=0"'));
assert.ok(actionRoute.includes("detectAiTeamActionCommand(goal)"));
assert.ok(actionRoute.includes("autonomyAllowsAiTeamAction"));
assert.ok(actionRoute.includes("isAiTeamOperationStopRequested"));
assert.ok(actionRoute.includes("isAiTeamMissionStopRequested"));
assert.ok(actionRoute.includes("requestAiTeamMissionStop"));
assert.ok(actionRoute.includes("request.signal.aborted"));
assert.ok(actionRoute.includes("createAiTeamMission"));
assert.ok(actionRoute.includes('"running"'));
assert.ok(actionRoute.includes('"verifying"'));
assert.ok(actionRoute.includes("appendAiTeamMissionEvent"));
assert.ok(actionRoute.includes("addAiTeamMissionChange"));
assert.ok(actionRoute.includes("addAiTeamMissionVerification"));
assert.ok(actionRoute.includes("finalizeAiTeamMission"));
assert.ok(actionRoute.includes("execution.verificationPassed"));
assert.ok(actionRoute.includes("logAdminEvent"));
assert.ok(actionRoute.includes('actionBridge: true'));
assert.ok(actionRoute.includes('status: 409'));
assert.ok(actionRoute.includes("operationId has already been used"));

for (const forbidden of [
  "child_process",
  "execSync(",
  "spawn(",
  "vercel deploy",
  "stripe.",
  "createCheckout",
  "deleteUser",
  "service_role_key",
]) {
  assert.ok(!actionRoute.includes(forbidden), `Action route must not contain ${forbidden}`);
  assert.ok(!actionRuntime.includes(forbidden), `Action runtime must not contain ${forbidden}`);
}
assert.ok(adminSection.includes("detectAiTeamActionCommand(trimmed)"));
assert.ok(adminSection.includes('"/api/admin/ai-team/actions"'));
assert.ok(adminSection.includes("ActionPostPayload"));
assert.ok(commandCenter.includes("Buxme OS V5.3"));
assert.ok(commandCenter.includes("MISSION ENGINE + ACTION BRIDGE"));
assert.ok(commandCenter.includes("Registered action"));
assert.ok(commandCenter.includes("Run registered action"));
assert.ok(commandCenter.includes("server allowlist detected"));
assert.ok(commandCenter.includes("Allowlist only"));
assert.ok(commandCenter.includes("Unrestricted external/local execution remains disconnected"));

const bridgeIndex = capabilities.indexOf('id: "action-bridge"');
assert.ok(bridgeIndex >= 0, "Action Bridge capability must be registered");
assert.ok(
  capabilities.slice(bridgeIndex, bridgeIndex + 700).includes("available: true"),
  "Action Bridge capability must be available",
);
assert.ok(capabilities.includes('id: "filesystem-shell"'));
assert.ok(capabilities.includes('id: "payments"'));
assert.ok(capabilities.includes('id: "security-control"'));
assert.ok(capabilities.includes("available: false"));

assert.ok(missionReports.includes("actionFindings"));
assert.ok(missionReports.includes("mission.context.actionBridge === true"));
assert.ok(missionReports.includes("registered internal Buxme action bridge"));
assert.ok(health.includes('version: "5.3.0"'));
assert.ok(health.includes("actionBridge: persistenceConfigured"));
assert.ok(types.includes("export type AiTeamActionKey"));
assert.ok(types.includes("verificationPassed: boolean"));
assert.ok(briefRuntime.includes("collectAiTeamFounderBriefInput"));
assert.ok(briefRuntime.includes("generateAiTeamFounderBrief"));
assert.ok(briefRoute.includes("generateAiTeamFounderBrief"));
assert.ok(!briefRoute.includes("getAiTeamCustomerVoice"));
assert.ok(!briefRoute.includes("listRecentAiTeamRuns"));

console.log("✅ Buxme OS V5.3 Action Bridge invariant checks passed.");
