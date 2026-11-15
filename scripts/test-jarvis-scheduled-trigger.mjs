import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const dir = await mkdtemp(join(tmpdir(), "jarvis-scheduled-trigger-"));
const source = join(dir, "approved.json");
const queue = join(dir, "queue.json");
const baseEnv = { ...process.env, JARVIS_APPROVED_TASKS_PATH: source, JARVIS_QUEUE_PATH: queue };
const run = () => spawnSync(process.execPath, ["scripts/jarvis-scheduled-trigger.mjs"], {
  cwd: process.cwd(), encoding: "utf8", env: baseEnv,
});
const approved = {
  id: "buxme-review",
  title: "Research budget conversion",
  business: "buxme",
  status: "approved",
  reviewedAt: new Date().toISOString(),
  scheduledAt: new Date(Date.now() - 1_000).toISOString(),
  audit: [{ type: "proposed" }, { type: "approved", actor: "founder" }],
};

try {
  await writeFile(source, JSON.stringify([
    approved,
    { ...approved, id: "future-review", scheduledAt: new Date(Date.now() + 16 * 60 * 1000).toISOString() },
  ]));
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  const tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.deepEqual(tasks.map(task => task.id), ["buxme-review"]);
  assert.equal(tasks[0].businessName, "Buxme");
  assert.equal(tasks[0].audit.at(-1).type, "trigger_loaded");

  await writeFile(source, JSON.stringify([{ ...approved, status: "proposed" }]));
  assert.notEqual(run().status, 0);
  await writeFile(source, JSON.stringify([{ ...approved, scheduledAt: new Date(Date.now() + 91 * 24 * 60 * 60 * 1000).toISOString() }]));
  assert.notEqual(run().status, 0);
  console.log("Jarvis scheduled trigger tests passed: approval, scope, time-window, and 90-day bounds are enforced.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
