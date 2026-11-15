import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const dir = await mkdtemp(join(tmpdir(), "jarvis-business-queue-"));
const queue = join(dir, "queue.json");
const run = (...args) => spawnSync(process.execPath, ["scripts/jarvis-task-queue.mjs", ...args], {
  encoding: "utf8", env: { ...process.env, JARVIS_QUEUE_PATH: queue, JARVIS_ACTOR: "test-founder" },
});
try {
  assert.equal(run("add", "buxme-insights", "buxme", "Research revenue conversion").status, 0);
  assert.equal(run("add", "agency-site", "website-agency", "Build a TypeScript website").status, 0);
  assert.equal(run("add", "drive-booking", "drivenest", "Review customer booking workflow").status, 0);
  let tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.deepEqual(tasks.map(task => task.business), ["buxme", "website-agency", "drivenest"]);
  assert.deepEqual(tasks.map(task => task.businessName), ["Buxme", "Website-building agency", "DriveNest Auto Care"]);
  assert.deepEqual(tasks.map(task => task.model.kind), ["research", "coding", "business"]);
  assert.ok(tasks.every(task => task.audit.length === 1 && task.audit[0].type === "proposed"));

  const future = new Date(Date.now() + 60_000).toISOString();
  assert.equal(run("schedule", "drive-booking", future).status, 0);
  assert.notEqual(run("review", "drive-booking", "approved").status, 0);
  assert.equal(run("review", "buxme-insights", "approved").status, 0);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks[0].status, "approved");
  assert.deepEqual(tasks[0].audit.map(event => event.type), ["proposed", "approved"]);
  assert.equal(tasks[0].audit[1].actor, "test-founder");
  assert.equal(tasks[2].status, "proposed");
  assert.equal(tasks[2].audit.at(-1).type, "scheduled");
  assert.equal(run("add", "bounded-review", "buxme", "Review bounded schedule").status, 0);
  const tooFar = new Date(Date.now() + 91 * 24 * 60 * 60 * 1000).toISOString();
  assert.notEqual(run("schedule", "bounded-review", tooFar).status, 0);
  console.log("Jarvis business queue tests passed: scope, routing, scheduling, audit, approval gate.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
