import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const dir = await mkdtemp(join(tmpdir(), "jarvis-business-scheduler-"));
const queue = join(dir, "queue.json");
const results = join(dir, "results");
const approved = (id, kind = "research") => ({
  id,
  title: "Review budget transactions",
  business: "buxme",
  businessName: "Buxme",
  status: "approved",
  reviewedAt: new Date().toISOString(),
  attempts: 0,
  risk: "low",
  model: { kind, model: "openai/gpt-4o-mini", configured: false },
  audit: [{ type: "proposed" }, { type: "approved", actor: "reviewer" }],
});
const env = {
  ...process.env,
  JARVIS_QUEUE_PATH: queue,
  JARVIS_RESULTS_DIR: results,
  JARVIS_SCHEDULER_MAX_TASKS: "1",
  JARVIS_RETRY_DELAY_MS: "0",
};

try {
  await writeFile(queue, JSON.stringify([approved("first"), approved("second")]));
  let run = spawnSync(process.execPath, ["scripts/jarvis-business-scheduler.mjs"], {
    encoding: "utf8",
    env,
  });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), {
    status: "completed",
    maxTasks: 1,
    executed: 1,
    tasks: [{ taskId: "first", business: "buxme", status: "completed" }],
  });

  let tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks.find(task => task.id === "first").status, "completed");
  assert.equal(tasks.find(task => task.id === "second").status, "approved");

  run = spawnSync(process.execPath, ["scripts/jarvis-business-scheduler.mjs"], {
    encoding: "utf8",
    env: { ...env, JARVIS_SCHEDULER_MAX_TASKS: "5" },
  });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), {
    status: "completed",
    maxTasks: 5,
    executed: 1,
    tasks: [{ taskId: "second", business: "buxme", status: "completed" }],
  });
  tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.ok(tasks.every(task => task.status === "completed"));
  console.log("Jarvis business scheduler tests passed: bounded orchestration and durable worker claims.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
