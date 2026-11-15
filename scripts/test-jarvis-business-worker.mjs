import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const dir = await mkdtemp(join(tmpdir(), "jarvis-business-worker-"));
const queue = join(dir, "queue.json");
const results = join(dir, "results");
const run = () => spawnSync(process.execPath, ["scripts/jarvis-business-worker.mjs"], {
  cwd: process.cwd(),
  encoding: "utf8",
  env: { ...process.env, JARVIS_QUEUE_PATH: queue, JARVIS_RESULTS_DIR: results, JARVIS_WORKER_ID: "test-worker" },
});
const approved = (id, business, title, risk = "low") => ({
  id, business, businessName: business, title, status: "approved", risk, attempts: 0,
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
    { ...approved("retry-task", "buxme", "Retry a bounded internal review"), status: "running", attempts: 1, startedAt: "2020-01-01T00:00:00.000Z", executionId: "retry-run" },
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
  const retryTask = tasks.find(task => task.id === "retry-task");
  assert.equal(retryTask.status, "approved", JSON.stringify(tasks));
  assert.ok(retryTask.nextAttemptAt);
  assert.equal(retryTask.audit.at(-1).type, "retry_scheduled");
  assert.equal(tasks.find(task => task.id === "maxed-task").status, "failed", JSON.stringify(tasks));
  assert.deepEqual(tasks.find(task => task.id === "unsafe-task").audit.at(-1).type, "blocked");
  assert.equal(tasks.find(task => task.id === "maxed-task").audit.at(-1).type, "failed");

  const completed = tasks.find(task => task.id === "buxme-task");
  const record = JSON.parse(await readFile(join(results, `${completed.executionId}.json`), "utf8"));
  assert.equal(record.business, "buxme");
  assert.equal(record.result.business, "buxme");
  assert.equal(record.result.taskId, "buxme-task");
  assert.deepEqual(completed.audit.map(event => event.type), ["proposed", "approved", "claimed", "completed"]);

  completed.status = "running";
  completed.completedAt = undefined;
  completed.resultPath = undefined;
  await writeFile(queue, JSON.stringify(tasks));
  assert.equal(run().status, 0);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks.find(task => task.id === "buxme-task").status, "completed");
  assert.equal(tasks.find(task => task.id === "buxme-task").audit.at(-1).type, "reconciled_completed");
  assert.equal(tasks.find(task => task.id === "agency-task").status, "completed");
  assert.equal(tasks.find(task => task.id === "retry-task").status, "approved");
  assert.equal(tasks.find(task => task.id === "future-task").status, "approved");
  assert.equal(tasks.find(task => task.id === "unreviewed-task").status, "approved");
  assert.equal((await readdir(results)).length, 2);
  const agencyRecord = JSON.parse(await readFile(join(results, `${tasks.find(task => task.id === "agency-task").executionId}.json`), "utf8"));
  assert.equal(agencyRecord.business, "website-agency");
  assert.equal(agencyRecord.result.business, "website-agency");
  assert.equal(agencyRecord.result.taskId, "agency-task");
  assert.equal(tasks.find(task => task.id === "buxme-task").attempts, 1);
  console.log("Jarvis business worker tests passed: claim, due/approval gates, isolation, results, audit, blocking, retry cap.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
