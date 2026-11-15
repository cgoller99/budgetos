import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const dir = await mkdtemp(join(tmpdir(), "jarvis-worker-"));
const queue = join(dir, "queue.json");
const results = join(dir, "results");
const run = () => spawnSync(process.execPath, ["scripts/jarvis-business-worker.mjs"], {
  cwd: process.cwd(),
  encoding: "utf8",
  env: { ...process.env, JARVIS_QUEUE_PATH: queue, JARVIS_RESULTS_DIR: results, JARVIS_WORKER_ID: "test-worker" },
});
const approved = (id, business, title, risk = "low") => ({
  id, business, businessName: business, title, risk, status: "approved", attempts: 0,
  reviewedAt: "2026-11-15T00:00:00.000Z",
  audit: [{ type: "proposed" }, { type: "approved", actor: "reviewer" }],
});
const executionId = (id, attempt) =>
  createHash("sha256").update(`${id}:${attempt}`).digest("hex").slice(0, 20);

try {
  const collision = executionId("retry-me", 1);
  await mkdir(results, { recursive: true });
  await writeFile(join(results, `${collision}.json`), "occupied");
  await writeFile(queue, JSON.stringify([
    approved("buxme-task", "buxme", "Research product conversion"),
    approved("agency-task", "website-agency", "Build a reviewed website plan"),
    approved("unsafe-task", "drivenest", "Email customer about payment", "high"),
    { ...approved("future-task", "drivenest", "Review booking workflow"), scheduledAt: new Date(Date.now() + 60_000).toISOString() },
    { ...approved("unreviewed-task", "buxme", "Routine internal review"), reviewedAt: undefined, audit: [{ type: "proposed" }] },
    approved("retry-me", "buxme", "Routine internal review"),
    { ...approved("stale-task", "buxme", "Routine stale review"), status: "running", attempts: 3,
      startedAt: "2020-01-01T00:00:00.000Z", executionId: "stale-run" },
  ]));

  assert.equal(run().status, 0);
  assert.equal(run().status, 0);
  const first = run();
  assert.equal(first.status, 1, first.stderr);
  let tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks.find(task => task.id === "buxme-task").status, "completed");
  assert.equal(tasks.find(task => task.id === "unsafe-task").status, "blocked");
  assert.equal(tasks.find(task => task.id === "future-task").status, "approved");
  assert.equal(tasks.find(task => task.id === "unreviewed-task").status, "approved");
  assert.equal(tasks.find(task => task.id === "unreviewed-task").audit.at(-1).type, "proposed");
  assert.equal(tasks.find(task => task.id === "stale-task").status, "failed");
  const retry = tasks.find(task => task.id === "retry-me");
  assert.equal(retry.status, "approved");
  assert.equal(retry.attempts, 1);
  assert.equal(retry.audit.at(-1).type, "retry_scheduled");

  await unlink(join(results, `${collision}.json`));
  retry.nextAttemptAt = new Date(Date.now() - 1_000).toISOString();
  await writeFile(queue, JSON.stringify(tasks));
  assert.equal(run().status, 0);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks.find(task => task.id === "retry-me").status, "completed");
  assert.equal(tasks.find(task => task.id === "agency-task").status, "completed");
  assert.equal(tasks.find(task => task.id === "unreviewed-task").status, "approved");
  const buxmeResult = JSON.parse(await readFile(join(results, `${executionId("buxme-task", 1)}.json`), "utf8"));
  const agency = tasks.find(task => task.id === "agency-task");
  const agencyResult = JSON.parse(await readFile(join(results, `${agency.executionId}.json`), "utf8"));
  assert.equal(buxmeResult.result.business, "buxme");
  assert.equal(agencyResult.result.business, "website-agency");
  assert.equal(agencyResult.result.taskId, "agency-task");
  assert.deepEqual(tasks.find(task => task.id === "buxme-task").audit.map(event => event.type),
    ["proposed", "approved", "claimed", "completed"]);
  console.log("Jarvis business worker tests passed: claim, due/approval gates, isolation, results, audit, retries, lease expiry.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
