import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const dir = await mkdtemp(join(tmpdir(), "jarvis-execute-test-"));
const queue = join(dir, "queue.json"), results = join(dir, "results");
const run = () => spawnSync(process.execPath, ["scripts/jarvis-execute.mjs"], { encoding: "utf8", env: { ...process.env, JARVIS_QUEUE_PATH: queue, JARVIS_RESULTS_DIR: results } });
try {
  await writeFile(queue, JSON.stringify([
    { id: "unknown-task", status: "approved", attempts: 0 },
    { id: "revenue-funnel-audit", status: "proposed", attempts: 0 },
    { id: "organic-marketing-campaign", status: "approved", attempts: 0 }
  ]));
  assert.equal(run().status, 0);
  let tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks[0].status, "approved");
  assert.equal(tasks[1].status, "proposed");
  assert.equal(tasks[2].status, "completed");
  assert.equal(tasks[2].agent, "marketing");
  assert.equal(tasks[2].attempts, 1);
  const record = JSON.parse(await readFile(join(results, tasks[2].executionId + ".json"), "utf8"));
  assert.equal(record.status, "completed");
  assert.equal(record.result.action, "attribution-inventory");
  assert.ok(record.completedAt && Array.isArray(record.result.evidence));
  assert.equal(run().status, 0);
  assert.equal((await readdir(results)).length, 1);
  assert.equal(JSON.parse(await readFile(queue, "utf8"))[2].attempts, 1);
  console.log("Jarvis execution tests passed: allowlist, approvals, results, timestamps, idempotency.");
} finally { await rm(dir, { recursive: true, force: true }); }
