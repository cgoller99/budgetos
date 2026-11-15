import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const dir = await mkdtemp(join(tmpdir(), "jarvis-business-worker-"));
const queue = join(dir, "queue.json");
const results = join(dir, "results");
const env = { ...process.env, JARVIS_QUEUE_PATH: queue, JARVIS_RESULTS_DIR: results, JARVIS_WORKER_ID: "test-worker" };
const run = (...args) => spawnSync(process.execPath, args, { cwd: process.cwd(), encoding: "utf8", env });
const cli = (...args) => run("scripts/jarvis-task-queue.mjs", ...args);

try {
  assert.equal(cli("add", "buxme-research", "buxme", "Research conversion evidence").status, 0);
  assert.equal(cli("add", "agency-plan", "website-agency", "Build a TypeScript delivery plan").status, 0);
  assert.equal(cli("add", "blocked-payment", "drivenest", "Email customer about payment").status, 0);
  assert.equal(cli("add", "future-booking", "drivenest", "Review booking workflow").status, 0);
  const future = new Date(Date.now() + 60_000).toISOString();
  assert.equal(cli("schedule", "future-booking", future).status, 0);
  assert.equal(cli("review", "buxme-research", "approved").status, 0);
  assert.equal(cli("review", "agency-plan", "approved").status, 0);
  assert.equal(cli("review", "blocked-payment", "approved").status, 0);
  assert.notEqual(cli("review", "future-booking", "approved").status, 0);

  let result = run("scripts/jarvis-business-worker.mjs");
  assert.equal(result.status, 0, result.stderr);
  let tasks = JSON.parse(await readFile(queue, "utf8"));
  const buxme = tasks.find(task => task.id === "buxme-research");
  assert.equal(buxme.status, "completed");
  assert.deepEqual(buxme.audit.map(entry => entry.type), ["proposed", "approved", "claimed", "completed"]);
  const record = JSON.parse(await readFile(join(results, `${buxme.executionId}.json`), "utf8"));
  assert.equal(record.business, "buxme");
  assert.equal(record.result.taskId, buxme.id);
  assert.equal(record.result.business, "buxme");
  assert.match(record.result.details.deliverable, /Evidence-backed/);
  assert.equal(tasks.find(task => task.id === "blocked-payment").status, "blocked");
  assert.equal(tasks.find(task => task.id === "future-booking").status, "proposed");

  result = run("scripts/jarvis-business-worker.mjs");
  assert.equal(result.status, 0, result.stderr);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  const agency = tasks.find(task => task.id === "agency-plan");
  assert.equal(agency.status, "completed");
  const agencyRecord = JSON.parse(await readFile(join(results, `${agency.executionId}.json`), "utf8"));
  assert.equal(agencyRecord.business, "website-agency");
  assert.equal(agencyRecord.result.business, "website-agency");
  assert.equal((await readdir(results)).length, 2);

  await writeFile(queue, JSON.stringify([
    {
      id: "retrying", title: "Routine internal check", business: "buxme",
      businessName: "Buxme", status: "running", risk: "low", attempts: 1,
      reviewedAt: "2026-11-15T00:00:00.000Z", startedAt: "2020-01-01T00:00:00.000Z",
      executionId: "old-execution", audit: [{ type: "approved" }],
    },
    {
      id: "exhausted", title: "Routine internal check", business: "buxme",
      businessName: "Buxme", status: "running", risk: "low", attempts: 3,
      reviewedAt: "2026-11-15T00:00:00.000Z", startedAt: "2020-01-01T00:00:00.000Z",
      executionId: "exhausted-execution", audit: [{ type: "approved" }],
    },
  ]));
  result = run("scripts/jarvis-business-worker.mjs");
  assert.equal(result.status, 0, result.stderr);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks.find(task => task.id === "retrying").status, "approved");
  assert.ok(tasks.find(task => task.id === "retrying").nextAttemptAt);
  assert.equal(tasks.find(task => task.id === "exhausted").status, "failed");
  assert.deepEqual(tasks.find(task => task.id === "exhausted").audit.at(-1).type, "failed");
  console.log("Jarvis business worker tests passed: approval/due gates, isolation, results, audit, blocking, lease retry cap.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
