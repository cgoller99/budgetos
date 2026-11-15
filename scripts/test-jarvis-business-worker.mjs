import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { dispatchTask, validateClaimable } from "../lib/jarvis/businessWorker.mjs";

const dir = await mkdtemp(join(tmpdir(), "jarvis-business-worker-"));
const queue = join(dir, "queue.json");
const results = join(dir, "results");
const env = {
  ...process.env,
  JARVIS_QUEUE_PATH: queue,
  JARVIS_RESULTS_DIR: results,
  JARVIS_WORKER_ID: "test-worker",
};
const run = () => spawnSync(process.execPath, ["scripts/jarvis-business-worker.mjs"], {
  cwd: process.cwd(), encoding: "utf8", env,
});
const approved = (id, business, title, risk = "low") => ({
  id, business, businessName: business, title, status: "approved", risk, attempts: 0,
  createdAt: id === "buxme-task"
    ? "2026-01-01T00:00:00.000Z"
    : "2026-01-02T00:00:00.000Z",
  reviewedAt: "2026-11-15T00:00:00.000Z",
  audit: [{ type: "proposed" }, { type: "approved", actor: "human-reviewer" }],
});

try {
  const safe = approved("buxme-task", "buxme", "Research product conversion");
  assert.equal(validateClaimable(safe), true);
  assert.throws(() => dispatchTask({
    ...safe, status: "running", reviewedAt: undefined, attempts: 1,
    audit: [{ type: "proposed" }],
  }), /approval/);
  assert.throws(() => dispatchTask({
    ...safe, status: "running", attempts: 1, scheduledAt: "2999-01-01T00:00:00.000Z",
  }), /due/);
  assert.throws(() => dispatchTask({
    ...safe, status: "running", attempts: 1, risk: undefined,
  }), /safety/);

  await writeFile(queue, JSON.stringify([
    safe,
    approved("agency-task", "website-agency", "Build a reviewed website plan"),
    approved("unsafe-task", "drivenest", "Email customer about payment", "high"),
    { ...approved("future-task", "drivenest", "Review booking workflow"), scheduledAt: "2999-01-01T00:00:00.000Z" },
    { ...approved("unreviewed-task", "buxme", "Routine internal check"), reviewedAt: undefined, audit: [{ type: "proposed" }] },
    { ...approved("maxed-task", "buxme", "Old task"), status: "running", attempts: 3, startedAt: "2020-01-01T00:00:00.000Z", executionId: "old-run" },
  ]));

  assert.equal(run().status, 0);
  let tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks.find(task => task.id === "buxme-task").status, "completed");
  assert.equal(tasks.find(task => task.id === "agency-task").status, "approved");
  assert.equal(tasks.find(task => task.id === "unsafe-task").status, "blocked");
  assert.equal(tasks.find(task => task.id === "future-task").status, "approved");
  assert.equal(tasks.find(task => task.id === "unreviewed-task").status, "approved");
  assert.equal(tasks.find(task => task.id === "maxed-task").status, "failed");
  const completed = tasks.find(task => task.id === "buxme-task");
  const record = JSON.parse(await readFile(join(results, `${completed.executionId}.json`), "utf8"));
  assert.equal(record.business, "buxme");
  assert.equal(record.result.business, "buxme");
  assert.deepEqual(completed.audit.map(event => event.type), ["proposed", "approved", "claimed", "completed"]);

  assert.equal(run().status, 0);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks.find(task => task.id === "agency-task").status, "completed");

  tasks.push({
    ...approved("lease-retry", "drivenest", "Review booking workflow"),
    status: "running", attempts: 1, startedAt: "2020-01-01T00:00:00.000Z", executionId: "stale-run",
  });
  await writeFile(queue, JSON.stringify(tasks));
  assert.equal(run().status, 0);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  const retried = tasks.find(task => task.id === "lease-retry");
  assert.equal(retried.status, "completed");
  assert.equal(retried.attempts, 2);
  assert.deepEqual(retried.audit.map(event => event.type), [
    "proposed", "approved", "retry_scheduled", "claimed", "completed",
  ]);
  assert.equal((await readdir(results)).length, 3);
  console.log("Jarvis business worker tests passed: gates, claim, isolation, results, audit, lease retry cap.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
