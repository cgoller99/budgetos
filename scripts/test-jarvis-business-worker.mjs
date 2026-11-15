import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const dir = await mkdtemp(join(tmpdir(), "jarvis-business-worker-"));
const queue = join(dir, "queue.json");
const results = join(dir, "results");
const baseEnv = {
  ...process.env,
  JARVIS_QUEUE_PATH: queue,
  JARVIS_RESULTS_DIR: results,
  JARVIS_ACTOR: "worker-test",
  JARVIS_RETRY_DELAY_MS: "0",
};
const run = (extra = {}) => spawnSync(process.execPath, ["scripts/jarvis-business-worker.mjs"], {
  encoding: "utf8",
  env: { ...baseEnv, ...extra },
});
const task = (id, overrides = {}) => ({
  id,
  title: "Review budget transactions",
  business: "buxme",
  businessName: "Buxme",
  status: "approved",
  reviewedAt: new Date().toISOString(),
  attempts: 0,
  risk: "low",
  model: { kind: "research", model: "openai/gpt-4o-mini" },
  audit: [{ type: "proposed", actor: "test-founder", at: new Date().toISOString() }],
  ...overrides,
});
const businessTask = (id, business, kind, title) => task(id, {
  business,
  businessName: business === "website-agency" ? "Website-building agency" : "DriveNest Auto Care",
  title,
  model: { kind, model: "openai/gpt-4o-mini" },
});

try {
  await writeFile(queue, JSON.stringify([
    task("buxme-research"),
    businessTask("agency-coding", "website-agency", "coding", "Build a landing page"),
    businessTask("drivenest-business", "drivenest", "business", "Review customer booking"),
    task("future-task", { scheduledAt: new Date(Date.now() + 60_000).toISOString() }),
    task("unreviewed-task", { status: "proposed", reviewedAt: undefined }),
    task("unsafe-task", { risk: "high", title: "Send customer payment email" }),
  ]));
  assert.equal(run().status, 0);
  let tasks = JSON.parse(await readFile(queue, "utf8"));
  const completed = tasks.find(item => item.id === "buxme-research");
  assert.equal(completed.status, "completed");
  assert.deepEqual(completed.audit.map(item => item.type), ["proposed", "claimed", "completed"]);
  const record = JSON.parse(await readFile(join(results, `${completed.executionId}.json`), "utf8"));
  assert.equal(record.business, "buxme");
  assert.equal(record.result.handler, "buxme.research.inventory");
  assert.deepEqual(record.result.scope, ["app", "components", "lib"]);
  assert.ok(Array.isArray(record.result.evidence));
  assert.equal(run().status, 0);
  assert.equal(run().status, 0);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks.find(item => item.id === "agency-coding").status, "completed");
  assert.equal(tasks.find(item => item.id === "drivenest-business").status, "completed");
  const records = await Promise.all([..."agency-coding drivenest-business".split(" ").map(async id => {
    const item = tasks.find(taskItem => taskItem.id === id);
    return JSON.parse(await readFile(join(results, `${item.executionId}.json`), "utf8"));
  })]);
  assert.deepEqual(records.map(item => item.result.handler), [
    "website-agency.coding.inventory",
    "drivenest.business.inventory",
  ]);
  assert.equal(tasks.find(item => item.id === "future-task").status, "approved");
  assert.equal(tasks.find(item => item.id === "unreviewed-task").status, "proposed");
  assert.equal(tasks.find(item => item.id === "unsafe-task").status, "approved");
  assert.equal(await readdir(results).then(items => items.length), 3);

  await writeFile(queue, JSON.stringify([task("retry-task")]));
  assert.notEqual(run({ JARVIS_TEST_FAIL_ONCE: "retry-task:1" }).status, 0);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks[0].status, "approved");
  assert.equal(tasks[0].attempts, 1);
  assert.equal(tasks[0].audit.at(-1).type, "failed");
  assert.equal(run().status, 0);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks[0].status, "completed");
  assert.equal(tasks[0].attempts, 2);
  assert.deepEqual(tasks[0].audit.map(item => item.type), ["proposed", "claimed", "failed", "claimed", "completed"]);

  await writeFile(queue, JSON.stringify([task("exhausted-retry-task", { attempts: 2 })]));
  assert.notEqual(run({ JARVIS_TEST_FAIL_ONCE: "exhausted-retry-task:3" }).status, 0);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks[0].status, "failed");
  assert.equal(tasks[0].attempts, 3);
  assert.equal(tasks[0].audit.at(-1).type, "failed");

  const reconciled = task("reconciled-task", { attempts: 1, status: "running", startedAt: "2020-01-01T00:00:00.000Z" });
  reconciled.executionId = createHash("sha256").update("reconciled-task:1").digest("hex").slice(0, 20);
  await writeFile(join(results, `${reconciled.executionId}.json`), JSON.stringify({
    taskId: reconciled.id,
    executionId: reconciled.executionId,
    status: "completed",
    completedAt: new Date().toISOString(),
  }));
  await writeFile(queue, JSON.stringify([reconciled]));
  assert.equal(run().status, 0);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks[0].status, "completed");
  assert.equal(tasks[0].audit.at(-1).type, "reconciled_completed");

  await writeFile(queue, JSON.stringify([
    task("exhausted-task", { status: "running", attempts: 3, startedAt: "2020-01-01T00:00:00.000Z", executionId: "missing" }),
  ]));
  assert.equal(run().status, 0);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks[0].status, "failed");
  assert.equal(tasks[0].audit.at(-1).type, "lease_expired");
  console.log("Jarvis business worker tests passed: due/approval/safety gates, isolation, results, audit, retries, reconciliation.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
