import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  BUSINESSES,
  createBusinessTask,
  isDue,
  reviewBusinessTask,
  routeBusinessTask,
} from "../lib/jarvis/autonomousSlice.mjs";
import { selectJarvisModel } from "../lib/jarvis/modelRouting.ts";

assert.deepEqual(Object.keys(BUSINESSES), ["buxme", "website_agency", "drivenest_auto_care"]);
const task = createBusinessTask({
  id: "agency-homepage",
  title: "Prepare a homepage content brief",
  businessId: "website_agency",
  taskKind: "research",
  scheduledFor: "2026-11-15T08:00:00.000Z",
  now: "2026-11-15T07:00:00.000Z",
});
assert.equal(task.status, "proposed");
assert.equal(task.safety, "proposal_only");
assert.equal(task.approvalRequired, true);
assert.equal(isDue(task, Date.parse("2026-11-15T07:59:00.000Z")), false);
assert.equal(isDue(task, Date.parse("2026-11-15T08:00:00.000Z")), true);
assert.deepEqual(routeBusinessTask(task, kind => selectJarvisModel(kind, {
  JARVIS_RESEARCH_MODEL: "google/gemini-2.5-pro",
})), {
  kind: "research",
  model: "google/gemini-2.5-pro",
  configured: true,
});
reviewBusinessTask(task, "approved", "2026-11-15T07:30:00.000Z");
assert.equal(task.approvalStatus, "approved");
assert.deepEqual(task.audit.map(entry => entry.event), ["created", "approval_reviewed"]);
assert.equal(createBusinessTask({
  id: "drivenest-follow-up",
  title: "Draft a customer-data export",
  businessId: "drivenest_auto_care",
}).status, "blocked");

const dir = await mkdtemp(join(tmpdir(), "jarvis-business-queue-"));
const queuePath = join(dir, "queue.json");
const run = (...args) => spawnSync(process.execPath, ["scripts/jarvis-task-queue.mjs", ...args], {
  cwd: process.cwd(),
  encoding: "utf8",
  env: { ...process.env, JARVIS_QUEUE_PATH: queuePath },
});
try {
  assert.equal(run("add", "drive-reminder", "Draft a service reminder", "--business=drivenest_auto_care", "--kind=routine").status, 0);
  let tasks = JSON.parse((run("list").stdout));
  assert.equal(tasks[0].businessId, "drivenest_auto_care");
  assert.equal(tasks[0].businessName, "DriveNest Auto Care");
  assert.equal(tasks[0].approvalStatus, "pending");
  assert.equal(run("review", "drive-reminder", "approved").status, 0);
  tasks = JSON.parse((run("list").stdout));
  assert.equal(tasks[0].status, "approved");
  assert.deepEqual(tasks[0].audit.map(entry => entry.event), ["created", "approval_reviewed"]);
  assert.equal(run("add", "unsafe", "Deploy a production payment change", "--business=buxme").status, 0);
  tasks = JSON.parse((run("list").stdout));
  assert.equal(tasks.find(task => task.id === "unsafe").status, "blocked");
  assert.notEqual(run("review", "unsafe", "approved").status, 0);
  console.log("Jarvis autonomous slice passed: three business scopes, persistence, schedule, routing, audit, and approval gate.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
