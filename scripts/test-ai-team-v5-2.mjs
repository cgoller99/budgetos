import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  screenVision,
  visionRoute,
  commandCenter,
  browserInterfaces,
  capabilities,
  health,
  types,
] = await Promise.all([
  read("lib/ai-team/screenVision.ts"),
  read("app/api/admin/ai-team/vision/route.ts"),
  read("components/admin/ai-team/CommandCenterV5.tsx"),
  read("components/admin/ai-team/browserInterfaces.ts"),
  read("lib/ai-team/capabilities.ts"),
  read("app/api/health/ai-team/route.ts"),
  read("lib/ai-team/types.ts"),
]);
assert.ok(screenVision.includes("ToolLoopAgent"));
assert.ok(screenVision.includes("Output.object"));
assert.ok(screenVision.includes('"openai/gpt-5.6-luna"'));
assert.ok(screenVision.includes('type: "file"'));
assert.ok(screenVision.includes("frameDataUrl"));
assert.ok(screenVision.includes("AbortSignal.any"));
assert.ok(
  screenVision.includes("untrusted visual evidence"),
  "Visible screen text must never become agent instructions",
);
assert.ok(
  screenVision.includes("Never reveal sensitive or credential-like values"),
  "Vision must suppress sensitive values",
);
assert.ok(
  screenVision.includes("Do not claim that you clicked, typed, submitted, changed, or executed anything"),
  "Vision must not imply computer control",
);
assert.ok(!screenVision.includes(".from("), "Vision analysis must not persist screenshots");
assert.ok(visionRoute.includes("requireAdminApiUser()"));
assert.ok(visionRoute.includes('"Cache-Control": "no-store, max-age=0"'));
assert.ok(visionRoute.includes("MAX_DATA_URL_CHARS"));
assert.ok(visionRoute.includes("MAX_REQUEST_BYTES"));
assert.ok(visionRoute.includes("image\\/(?:jpeg|png|webp)"));
assert.ok(visionRoute.includes("request.signal"));
assert.ok(visionRoute.includes("buxmePersisted: false"));
assert.ok(visionRoute.includes("buxmeImageStored: false"));
assert.ok(!visionRoute.includes("logAdminEvent"));
assert.ok(!visionRoute.includes(".from("));

assert.ok(browserInterfaces.includes("getDisplayMedia"));
assert.ok(browserInterfaces.includes("maxDimension = 1600"));
assert.ok(browserInterfaces.includes('toDataURL("image/jpeg", 0.72)'));
assert.ok(browserInterfaces.includes("return frame"));
assert.ok(browserInterfaces.includes("setCapturedFrame(null)"));
for (const contract of [
  "Screen intelligence",
  "Analyze frame",
  "/api/admin/ai-team/vision",
  "does not write the screenshot to app storage or mission history",
  "NOT SAVED BY BUXME",
  "Use findings in mission",
  "that command will be persisted if you start the mission",
  "The AI has not analyzed your screen.",
]) {
  assert.ok(commandCenter.includes(contract), `Missing V5.2 UI contract: ${contract}`);
}

assert.ok(commandCenter.includes("screenAnalysisAbortRef.current?.abort()"));
assert.ok(commandCenter.includes("turnScreenOff()"));
assert.ok(commandCenter.includes("setScreenAnalysis(null)"));
const screenIntelligence = capabilities.indexOf('id: "screen-intelligence"');
assert.ok(screenIntelligence >= 0, "Screen intelligence capability must be registered");
assert.ok(
  capabilities.slice(screenIntelligence, screenIntelligence + 600).includes("available: true"),
  "Screen intelligence must be available",
);
assert.match(health, /version: "5\.(?:2|3)\.\d+"/);
assert.ok(health.includes("screenIntelligence: runtimeConfigured"));
assert.ok(types.includes("export type AiTeamScreenAnalysis"));

for (const source of [screenVision, visionRoute, commandCenter, browserInterfaces]) {
  assert.ok(!source.includes("child_process"), "V5.2 screen intelligence must not execute shell commands");
  assert.ok(!source.includes("vercel deploy"), "V5.2 screen intelligence must not deploy");
  assert.ok(!source.includes("stripe."), "V5.2 screen intelligence must not execute financial actions");
}

console.log("✅ Buxme OS V5.2 screen-intelligence invariant checks passed.");
