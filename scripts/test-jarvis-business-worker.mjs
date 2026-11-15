import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const dir = await mkdtemp(join(tmpdir(), "jarvis-business-worker-"));
const queue = join(dir, "queue.json");
const results = join(dir, "results");
const approvedAudit = business => [
  { type: "proposed", business },
  { type: "approved", business, actor: "human-reviewer" },
];
const run = () => spawnSync(process.execPath, ["scripts/jarvis-business-worker.mjs"], {
  cwd: process.cwd(),
  encoding: "utf8",
  env: { ...process.env, JARVIS_QUEUE_PATH: queue, JARVIS_RESULTS_DIR: results, JARVIS_ACTOR: "test-worker" },
});
const task = (id, business, title, extra = {}) => ({
  id,
  title,
  business,
  businessName: { buxme: "Buxme", "website-agency": "Website-building agency", drivenest: "DriveNest Auto Care" }[business],
  status: "approved",
  attempts: 0,
  reviewedAt: "2026-11-15T00:00:00.000Z",
  audit: approvedAudit(business),
  ...extra,
});

try {
  await writeFile(queue, JSON.stringify([
    task("buxme-inventory", "buxme", "Inspect finance tracking"),
    task("future-task", "website-agency", "Inspect later", {
      scheduledAt: new Date(Date.now() + 60_000).toISOString(),
    }),
    { ...task("unapproved-task", "drivenest", "Never run"), status: "proposed", audit: [] },
    task("wrong-business-name", "buxme", "Wrong isolation", { businessName: "DriveNest Auto Care" }),
    task("high-risk-task", "drivenest", "Email customer about payment"),
    task("retry-task", "drivenest", "Retry operations inventory", {
      status: "running",
      attempts: 1,
      executionId: "old-execution",
      startedAt: "2020-01-01T00:00:00.000Z",
    }),
    task("attempt-cap", "buxme", "Must remain failed", {
      status: "running",
      attempts: 3,
      executionId: "capped-execution",
      startedAt: "2020-01-01T00:00:00.000Z",
    }),
  ]));

  assert.equal(run().status, 0, run().stderr);
  let tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks[0].status, "completed");
  assert.equal(tasks[0].attempts, 1);
  assert.deepEqual(tasks[0].audit.map(item => item.type), ["proposed", "approved", "claimed", "completed"]);
  const firstResult = JSON.parse(await readFile(join(results, `${tasks[0].executionId}.json`), "utf8"));
  assert.equal(firstResult.handler, "buxme-read-only-inventory");
  assert.equal(firstResult.result.taskId, "buxme-inventory");
  assert.equal(firstResult.result.business, "buxme");
  assert.ok(Array.isArray(firstResult.result.evidence.matches));

  assert.equal(run().status, 0, run().stderr);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks[1].status, "approved", "future work must not run");
  assert.equal(tasks[2].status, "proposed", "approval gate must hold");
  assert.equal(tasks[3].status, "blocked", "business identity mismatch must be blocked");
  assert.equal(tasks[3].audit.at(-1).type, "blocked");
  assert.equal(tasks[4].status, "blocked", "high-risk work must be blocked");
  assert.equal(tasks[4].audit.at(-1).type, "blocked");
  assert.equal(tasks[5].status, "completed", "stale work should be retried");
  assert.equal(tasks[5].attempts, 2);
  assert.ok(tasks[5].audit.some(item => item.type === "retry_scheduled"));
  assert.equal(tasks[6].status, "failed", "retry cap must fail closed");
  assert.ok(tasks[6].audit.some(item => item.type === "failed"));
  assert.equal((await readdir(results)).length, 2);

  assert.equal(run().status, 0);
  assert.match(run().stdout, /No approved, due, business-isolated tasks available/);
  console.log("Jarvis business worker tests passed: claim, due/approval/business gates, real handlers, results, audit, retry cap.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
