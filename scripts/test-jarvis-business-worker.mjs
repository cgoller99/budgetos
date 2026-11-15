import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const dir = await mkdtemp(join(tmpdir(), "jarvis-business-worker-"));
const queue = join(dir, "queue.json");
const results = join(dir, "results");
const approvedAudit = [{ type: "approved", actor: "test-founder", at: new Date().toISOString() }];
const run = () => spawnSync(process.execPath, ["scripts/jarvis-business-worker.mjs"], {
  encoding: "utf8",
  env: { ...process.env, JARVIS_QUEUE_PATH: queue, JARVIS_RESULTS_DIR: results, JARVIS_ACTOR: "test-worker" },
});

try {
  await writeFile(queue, JSON.stringify([
    {
      id: "buxme-read", title: "Inspect finance tracking", business: "buxme",
      status: "approved", attempts: 0, audit: approvedAudit,
    },
    {
      id: "future-task", title: "Inspect later", business: "website-agency",
      status: "approved", scheduledAt: new Date(Date.now() + 60_000).toISOString(), attempts: 0, audit: approvedAudit,
    },
    {
      id: "unapproved-task", title: "Never run", business: "drivenest",
      status: "proposed", attempts: 0, audit: [],
    },
    {
      id: "retry-task", title: "Retry operations inventory", business: "drivenest",
      status: "running", attempts: 1, executionId: "old-execution", startedAt: "2020-01-01T00:00:00.000Z",
      audit: approvedAudit,
    },
    {
      id: "attempt-cap", title: "Must remain failed", business: "buxme",
      status: "running", attempts: 3, executionId: "capped-execution", startedAt: "2020-01-01T00:00:00.000Z",
      audit: approvedAudit,
    },
  ]));

  assert.equal(run().status, 0);
  let tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks[0].status, "completed");
  assert.equal(tasks[0].attempts, 1);
  assert.deepEqual(tasks[0].audit.map(item => item.type), ["approved", "claimed", "completed"]);
  const firstResult = JSON.parse(await readFile(join(results, `${tasks[0].executionId}.json`), "utf8"));
  assert.equal(firstResult.business, "buxme");
  assert.equal(firstResult.handler, "buxme-read-only-inventory");
  assert.equal(firstResult.status, "completed");

  assert.equal(run().status, 0);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks[1].status, "approved", "future work must not run");
  assert.equal(tasks[2].status, "proposed", "approval gate must hold");
  assert.equal(tasks[3].status, "completed", "stale work should be retried");
  assert.equal(tasks[3].attempts, 2);
  assert.ok(tasks[3].audit.some(item => item.type === "retry_scheduled"));
  assert.equal(tasks[3].business, "drivenest");
  assert.equal(tasks[4].status, "failed", "retry cap must fail closed");
  assert.equal(tasks[4].attempts, 3);
  assert.ok(tasks[4].audit.some(item => item.type === "failed"));
  assert.equal((await readdir(results)).length, 2);

  assert.equal(run().status, 0);
  assert.match(run().stdout, /No approved, due, business-isolated tasks available/);
  console.log("Jarvis business worker tests passed: claim, due gate, approval gate, isolation, results, audit, retry cap.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
