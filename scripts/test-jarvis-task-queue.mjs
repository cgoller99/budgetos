import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
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
  let tasks = JSON.parse(run("list").stdout);
  assert.equal(tasks[0].status, "proposed");
  assert.equal(run("add", "scheduled-task", "Review scheduled work").status, 0);
  assert.equal(run("schedule", "scheduled-task", new Date(Date.now() + 60_000).toISOString()).status, 0);
  assert.equal(run("review", "scheduled-task", "approved").status, 0);
  tasks = JSON.parse(run("list").stdout);
  assert.equal(tasks[1].status, "approved");
  assert.ok(tasks[1].scheduledAt);
  assert.notEqual(run("schedule", "scheduled-task", new Date().toISOString()).status, 0);
  assert.equal(run("review", "fix-sync", "approved").status, 0);
  assert.notEqual(run("review", "fix-sync", "approved").status, 0);
  tasks = JSON.parse(run("list").stdout);
  assert.equal(tasks[0].status, "approved");
  assert.equal(tasks[0].attempts, 0);
  assert.equal(tasks[0].priority, 0);
  assert.deepEqual(tasks[0].audit.map(entry => entry.event), ["created", "reviewed"]);
  assert.equal(tasks[1].status, "approved");
  assert.deepEqual(tasks[1].audit.map(entry => entry.event), ["created", "scheduled", "reviewed"]);
  console.log("Jarvis task queue tests passed.");
} finally { await rm(dir, { recursive: true, force: true }); }

const mounted = spawnSync(process.execPath, ["--test", "apps/jarvis/test/mount.test.mjs"], { stdio: "inherit" });
if (mounted.status !== 0) process.exit(mounted.status ?? 1);
