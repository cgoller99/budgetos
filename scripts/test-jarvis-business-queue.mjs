import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const dir = await mkdtemp(join(tmpdir(), "jarvis-business-queue-"));
const queue = join(dir, "queue.json");
const run = (...args) => spawnSync(process.execPath, [
  "--experimental-strip-types", "scripts/jarvis-business-queue.mjs", ...args,
], { encoding: "utf8", env: { ...process.env, JARVIS_BUSINESS_QUEUE_PATH: queue } });
try {
  assert.equal(run("add", "buxme-growth", "buxme", "Improve subscription conversion").status, 0);
  assert.equal(run("add", "agency-site", "websiteAgency", "Fix TypeScript client landing page").status, 0);
  assert.equal(run("add", "drivenest-followup", "driveNest", "Research service reminder campaign").status, 0);
  const future = new Date(Date.now() + 86_400_000).toISOString();
  assert.equal(run("add", "future-review", "buxme", "Review budget onboarding", future).status, 0);
  let tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.deepEqual(tasks.map(task => task.business), ["buxme", "websiteAgency", "driveNest", "buxme"]);
  assert.deepEqual(tasks.map(task => task.route.kind), ["business", "coding", "research", "business"]);
  assert.deepEqual(tasks.map(task => task.audit.map(entry => entry.event)), [["created"], ["created"], ["created"], ["created"]]);

  assert.equal(run("claim", new Date(Date.now() + 60_000).toISOString()).stdout.trim(), "No approved task is due.");
  assert.equal(run("claim").stdout.trim(), "No approved task is due.", "unapproved work must not be claimable");
  assert.equal(run("approve", "buxme-growth").status, 0);
  assert.equal(run("approve", "future-review").status, 0);
  assert.match(run("claim").stdout, /Claimed buxme-growth/);
  assert.equal(run("claim").stdout.trim(), "No approved task is due.", "future work must wait for its schedule");
  assert.equal(run("complete", "buxme-growth", "proposal prepared").status, 0);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  const completed = tasks.find(task => task.id === "buxme-growth");
  assert.equal(completed.status, "completed");
  assert.deepEqual(completed.audit.map(entry => entry.event), ["created", "approved", "claimed", "completed"]);
  assert.equal(completed.audit.at(-1).execution, "recorded_only");
  assert.notEqual(run("approve", "buxme-growth").status, 0);
  console.log("Jarvis three-business vertical slice passed: scope, persistence, routing, scheduling, audit, and approval gate.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
