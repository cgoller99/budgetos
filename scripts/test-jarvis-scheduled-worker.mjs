import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const dir = await mkdtemp(join(tmpdir(), "jarvis-scheduled-worker-"));
const queue = join(dir, "queue.json");
const results = join(dir, "results");
const baseEnv = {
  ...process.env,
  JARVIS_QUEUE_PATH: queue,
  JARVIS_RESULTS_DIR: results,
  JARVIS_ACTOR: "schedule-test",
  JARVIS_RESEARCH_MODEL: "anthropic/claude-sonnet-4",
  JARVIS_TRIGGER_MAX_RETRIES: "3",
  JARVIS_TRIGGER_RETRY_DELAY_MS: "10",
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
const runAfterContention = () => new Promise(resolve => {
  const lock = `${queue}.lock`;
  const child = spawn(process.execPath, ["scripts/jarvis-scheduled-worker.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: baseEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", chunk => {
    stderr += chunk;
  });
  setTimeout(() => rm(lock, { force: true }).catch(() => {}), 250);
  child.on("close", code => resolve({ code, stderr }));
});

try {
  await writeFile(queue, JSON.stringify([task]));
  await writeFile(`${queue}.lock`, "transient test contention");
  const contentionRun = runAfterContention();
  const contention = await contentionRun;
  assert.equal(contention.code, 0, contention.stderr);
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
  console.log("Jarvis scheduled worker integration test passed: future tasks wait, due tasks claim and complete with audit.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
