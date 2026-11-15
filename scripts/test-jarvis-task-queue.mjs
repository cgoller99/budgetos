import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const dir = await mkdtemp(join(tmpdir(), "jarvis-queue-test-"));
const path = join(dir, "queue.json");
const run = (...args) => spawnSync(process.execPath, ["scripts/jarvis-task-queue.mjs", ...args], { encoding: "utf8", env: { ...process.env, JARVIS_QUEUE_PATH: path } });
try {
  assert.deepEqual(JSON.parse(run("list").stdout), []);
  assert.equal(run("add", "fix-sync", "Investigate bank sync failures").status, 0);
  assert.notEqual(run("add", "fix-sync", "Duplicate").status, 0);
  assert.notEqual(run("add", "../escape", "Invalid").status, 0);
  assert.notEqual(run("schedule", "fix-sync", new Date(Date.now() + 91 * 24 * 60 * 60 * 1000).toISOString()).status, 0);
  assert.equal(run("schedule", "fix-sync", new Date(Date.now() - 1_000).toISOString()).status, 0);
  let tasks = JSON.parse(run("list").stdout);
  assert.equal(tasks[0].status, "proposed");
  assert.equal(run("review", "fix-sync", "approved").status, 0);
  assert.notEqual(run("review", "fix-sync", "approved").status, 0);
  tasks = JSON.parse(run("list").stdout);
  assert.equal(tasks[0].status, "approved");
  assert.equal(tasks[0].attempts, 0);

  const futureTasks = Array.from({ length: 25 }, (_, index) => ({
    id: `future-${index}`,
    title: `Future task ${index}`,
    business: "buxme",
    businessName: "Buxme",
    status: "proposed",
    attempts: 0,
    scheduledAt: index === 0 ? undefined : new Date(Date.now() + 60_000).toISOString(),
  }));
  await writeFile(path, JSON.stringify(futureTasks));
  assert.equal(run("schedule", "future-0", new Date(Date.now() + 120_000).toISOString()).status, 0);
  assert.notEqual(run("schedule", "future-1", new Date(Date.now() + 120_000).toISOString()).status, 0);
  console.log("Jarvis task queue tests passed.");
} finally { await rm(dir, { recursive: true, force: true }); }
