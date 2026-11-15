import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

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
  createdAt: id === "buxme-task" ? "2026-01-01T00:00:00.000Z" : "2026-01-02T00:00:00.000Z",
  reviewedAt: "2026-11-15T00:00:00.000Z",
  audit: [{ type: "proposed" }, { type: "approved", actor: "human-reviewer" }],
});

try {
  await writeFile(queue, JSON.stringify([
    approved("buxme-task", "buxme", "Research product conversion"),
    approved("agency-task", "website-agency", "Build a reviewed website plan"),
    approved("unsafe-task", "drivenest", "Email customer about payment", "high"),
    { ...approved("future-task", "drivenest", "Review booking workflow"), scheduledAt: new Date(Date.now() + 60_000).toISOString() },
    { ...approved("unreviewed-task", "buxme", "Routine internal check"), reviewedAt: undefined, audit: [{ type: "proposed" }] },
    { ...approved("maxed-task", "buxme", "Old task"), status: "running", attempts: 3, startedAt: "2020-01-01T00:00:00.000Z", executionId: "old-run" },
  ]));

  const firstRun = run();
  assert.equal(firstRun.status, 0, firstRun.stderr);
  let tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks.find(task => task.id === "buxme-task").status, "completed", JSON.stringify(tasks));
  assert.equal(tasks.find(task => task.id === "agency-task").status, "approved", JSON.stringify(tasks));
  assert.equal(tasks.find(task => task.id === "unsafe-task").status, "blocked", JSON.stringify(tasks));
  assert.equal(tasks.find(task => task.id === "future-task").status, "approved", JSON.stringify(tasks));
  assert.equal(tasks.find(task => task.id === "unreviewed-task").status, "approved", JSON.stringify(tasks));
  assert.equal(tasks.find(task => task.id === "maxed-task").status, "failed", JSON.stringify(tasks));
  const completed = tasks.find(task => task.id === "buxme-task");
  const record = JSON.parse(await readFile(join(results, `${completed.executionId}.json`), "utf8"));
  assert.equal(record.business, "buxme");
  assert.equal(record.result.business, "buxme");
  assert.equal(record.result.taskId, "buxme-task");
  assert.deepEqual(completed.audit.map(event => event.type), ["proposed", "approved", "claimed", "completed"]);
  assert.equal(run().status, 0);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks.find(task => task.id === "agency-task").status, "completed");

  // A stale lease is recovered and retried, while the max-attempt task above
  // is permanently failed instead of being claimed again.
  tasks.push({
    ...approved("lease-retry", "drivenest", "Review booking workflow"),
    status: "running",
    attempts: 1,
    startedAt: "2020-01-01T00:00:00.000Z",
    executionId: "stale-run",
  });
  await writeFile(queue, JSON.stringify(tasks));
  assert.equal(run().status, 0);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  const retried = tasks.find(task => task.id === "lease-retry");
  assert.equal(retried.status, "completed");
  assert.equal(retried.attempts, 2);
  assert.deepEqual(retried.audit.map(event => event.type), ["proposed", "approved", "retry_scheduled", "claimed", "completed"]);

  assert.equal(run().status, 0);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks.find(task => task.id === "agency-task").status, "completed");
  assert.equal(tasks.find(task => task.id === "future-task").status, "approved");
  assert.equal(tasks.find(task => task.id === "unreviewed-task").status, "approved");
  const agency = tasks.find(task => task.id === "agency-task");
  const agencyRecord = JSON.parse(await readFile(join(results, `${agency.executionId}.json`), "utf8"));
  assert.equal(agencyRecord.business, "website-agency");
  assert.equal(agencyRecord.result.business, "website-agency");
  assert.equal((await readdir(results)).length, 3);
  console.log("Jarvis business worker tests passed: claim, due/approval gates, isolation, results, audit, retry cap.");
} finally {
  await rm(dir, { recursive: true, force: true });
}

