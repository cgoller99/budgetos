import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const dir = await mkdtemp(join(tmpdir(), "jarvis-business-scheduler-"));
const queue = join(dir, "queue.json");
const results = join(dir, "results");
const report = join(dir, "report.json");
const baseEnv = {
  ...process.env,
  JARVIS_QUEUE_PATH: queue,
  JARVIS_RESULTS_DIR: results,
  JARVIS_SCHEDULER_REPORT_PATH: report,
  JARVIS_RETRY_DELAY_MS: "0",
  JARVIS_ACTOR: "scheduler-test",
};
const run = (extra = {}) => spawnSync(process.execPath, ["scripts/jarvis-business-scheduler.mjs"], {
  encoding: "utf8",
  env: { ...baseEnv, ...extra },
});
const approved = (id, overrides = {}) => ({
  id,
  title: "Review budget transactions",
  business: "buxme",
  businessName: "Buxme",
  status: "approved",
  reviewedAt: new Date().toISOString(),
  attempts: 0,
  risk: "low",
  model: { kind: "research", model: "openai/gpt-4o-mini" },
  audit: [{ type: "proposed" }, { type: "approved" }],
  ...overrides,
});

try {
  await writeFile(queue, JSON.stringify([]));
  assert.equal(run().status, 0);
  let snapshot = JSON.parse(await readFile(report, "utf8"));
  assert.equal(snapshot.status, "completed");
  assert.equal(snapshot.queue.approved, 0);
  assert.equal(snapshot.queue.completed, 0);
  assert.match(snapshot.executionContract, /one approved/);

  await writeFile(queue, JSON.stringify([approved("scheduled")]));
  assert.equal(run().status, 0);
  snapshot = JSON.parse(await readFile(report, "utf8"));
  assert.equal(snapshot.queue.completed, 1);
  assert.equal(JSON.parse(await readFile(queue, "utf8"))[0].status, "completed");

  await writeFile(queue, JSON.stringify([approved("failure")]));
  assert.notEqual(run({ JARVIS_TEST_FAIL_ONCE: "failure:1" }).status, 0);
  snapshot = JSON.parse(await readFile(report, "utf8"));
  assert.equal(snapshot.status, "worker_failed");
  assert.equal(snapshot.queue.approved, 1);
  console.log("Jarvis business scheduler tests passed: bounded tick, durable report, worker failure propagation.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
