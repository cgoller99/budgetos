import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const dir = await mkdtemp(join(tmpdir(), "jarvis-scheduled-trigger-"));
const source = join(dir, "approved.json");
const queue = join(dir, "queue.json");
const reviewedAt = new Date().toISOString();
const task = (id, business) => ({
  id,
  title: `Read-only ${business} review`,
  business,
  status: "approved",
  reviewedAt,
  scheduledAt: new Date(Date.now() - 1_000).toISOString(),
  risk: "low",
  model: { kind: "research" },
  audit: [{ type: "proposed", actor: "founder" }, { type: "approved", actor: "reviewer" }],
});

const env = {
  ...process.env,
  JARVIS_APPROVED_TASKS_PATH: source,
  JARVIS_QUEUE_PATH: queue,
};

try {
  await writeFile(source, JSON.stringify([
    task("buxme-review", "buxme"),
    task("agency-review", "website-agency"),
    task("drivenest-review", "drivenest"),
    { ...task("later-review", "buxme"), scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
  ]));
  const loaded = spawnSync(process.execPath, ["scripts/jarvis-scheduled-trigger.mjs"], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
  });
  assert.equal(loaded.status, 0, loaded.stderr);
  const queueData = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(queueData.length, 3);
  assert.deepEqual(queueData.map(item => item.business), ["buxme", "website-agency", "drivenest"]);
  assert.ok(queueData.every(item => item.audit.at(-1).type === "trigger_loaded"));

  await writeFile(source, JSON.stringify([{ ...task("unreviewed", "buxme"), audit: [{ type: "proposed" }] }]));
  const rejected = spawnSync(process.execPath, ["scripts/jarvis-scheduled-trigger.mjs"], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
  });
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /approval audit event/);
  console.log("Jarvis scheduled trigger tests passed: three-business loading and approval fail-closed behavior.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
