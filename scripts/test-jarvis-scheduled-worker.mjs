import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, unlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const dir = await mkdtemp(join(tmpdir(), "jarvis-scheduled-worker-"));
const queue = join(dir, "queue.json");
const results = join(dir, "results");
const baseEnv = {
  ...process.env,
  JARVIS_QUEUE_PATH: queue,
  JARVIS_RESULTS_DIR: results,
  JARVIS_ACTOR: "schedule-test",
  JARVIS_SCHEDULE_MAX_TASKS: "2",
  JARVIS_SCHEDULER_LOCK_MS: "1000",
  JARVIS_RESEARCH_MODEL: "anthropic/claude-sonnet-4",
};
const task = {
  id: "scheduled-review",
  title: "Review budget transactions",
  business: "buxme",
  businessName: "Buxme",
  status: "approved",
  reviewedAt: new Date().toISOString(),
  scheduledAt: new Date(Date.now() + 60_000).toISOString(),
  attempts: 0,
  risk: "low",
  model: { kind: "research", model: "openai/gpt-4o-mini" },
  audit: [
    { type: "proposed", actor: "test-founder" },
    { type: "approved", actor: "test-reviewer" },
    { type: "scheduled", actor: "test-founder" },
  ],
};
const run = () => spawnSync(process.execPath, ["scripts/jarvis-scheduled-worker.mjs"], {
  cwd: process.cwd(),
  encoding: "utf8",
  env: baseEnv,
});

try {
  await writeFile(queue, JSON.stringify([task]));
  const futureRun = run();
  assert.equal(futureRun.status, 0, futureRun.stderr);
  let tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks[0].status, "approved");
  assert.deepEqual(await readdir(results).catch(error => {
    assert.equal(error.code, "ENOENT");
    return [];
  }), []);

  tasks[0].scheduledAt = new Date(Date.now() - 1_000).toISOString();
  await writeFile(queue, JSON.stringify(tasks));
  const dueRun = run();
  assert.equal(dueRun.status, 0, dueRun.stderr);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks[0].status, "completed");
  assert.ok(tasks[0].claimId);
  assert.deepEqual(
    tasks[0].audit.map(event => event.type),
    ["proposed", "approved", "scheduled", "claimed", "completed"],
  );
  const result = JSON.parse(await readFile(join(results, `${tasks[0].executionId}.json`), "utf8"));
  assert.equal(result.status, "completed");
  assert.equal(result.claimId, tasks[0].claimId);
  assert.equal(result.result.sideEffects.length, 0);
  assert.equal(result.audit.at(-1).type, "completed");

  const batch = [1, 2, 3].map(index => ({
    ...task,
    id: `batch-${index}`,
    scheduledAt: new Date(Date.now() - 1_000).toISOString(),
    audit: [...task.audit],
  }));
  await writeFile(queue, JSON.stringify(batch));
  const boundedRun = run();
  assert.equal(boundedRun.status, 0, boundedRun.stderr);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks.filter(item => item.status === "completed").length, 2);
  assert.equal(tasks.filter(item => item.status === "approved").length, 1);
  assert.ok(tasks.filter(item => item.status === "completed")
    .every(item => item.audit.some(event => event.type === "claimed")));

  const activeLock = `${queue}.scheduler.lock`;
  await writeFile(activeLock, JSON.stringify({ pid: 999 }));
  const skippedRun = run();
  assert.equal(skippedRun.status, 0, skippedRun.stderr);
  assert.match(skippedRun.stdout, /already running/i);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks.filter(item => item.status === "approved").length, 1);
  await utimes(activeLock, new Date(Date.now() - 2_000), new Date(Date.now() - 2_000));
  const staleLockRun = run();
  assert.equal(staleLockRun.status, 0, staleLockRun.stderr);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks.filter(item => item.status === "completed").length, 3);
  await unlink(activeLock).catch(() => {});
  console.log("Jarvis scheduled worker integration test passed: future tasks wait, due tasks claim and complete with audit.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
