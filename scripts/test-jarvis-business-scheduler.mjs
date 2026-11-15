import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const dir = await mkdtemp(join(tmpdir(), "jarvis-business-scheduler-"));
const queue = join(dir, "queue.json");
const results = join(dir, "results");
const env = {
  ...process.env,
  JARVIS_QUEUE_PATH: queue,
  JARVIS_RESULTS_DIR: results,
  JARVIS_ACTOR: "scheduler-test",
  JARVIS_RETRY_DELAY_MS: "0",
  JARVIS_SCHEDULER_MAX_TASKS: "2",
};
const task = id => ({
  id,
  title: "Review budget transactions",
  business: "buxme",
  businessName: "Buxme",
  status: "approved",
  reviewedAt: new Date().toISOString(),
  attempts: 0,
  risk: "low",
  model: { kind: "research", model: "openai/gpt-4o-mini" },
  audit: [{ type: "proposed" }, { type: "approved", actor: "human-reviewer" }],
});

try {
  await writeFile(queue, JSON.stringify([task("one"), task("two")]));
  const run = spawnSync(process.execPath, ["scripts/jarvis-business-scheduler.mjs"], {
    encoding: "utf8",
    env,
  });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout), {
    actor: "scheduler-test",
    maxTasks: 2,
    attempted: 2,
    completed: 2,
    idle: false,
    failures: [],
  });

  const tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.ok(tasks.every(item => item.status === "completed"));
  assert.ok(tasks.every(item => item.audit.some(event => event.type === "model_routed")));
  assert.ok(tasks.every(item => item.audit.some(event => event.type === "completed")));
  assert.ok(tasks.every(item => item.model.model === "openai/gpt-4o-mini"));
  assert.equal(await stat(`${queue}.scheduler.lock`).then(() => true, error => error.code === "ENOENT"), true);

  const idle = spawnSync(process.execPath, ["scripts/jarvis-business-scheduler.mjs"], {
    encoding: "utf8",
    env,
  });
  assert.equal(idle.status, 0, idle.stderr);
  assert.equal(JSON.parse(idle.stdout).idle, true);
  console.log("Jarvis business scheduler tests passed: bounded orchestration, durable claims, routing audit, and cleanup.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
