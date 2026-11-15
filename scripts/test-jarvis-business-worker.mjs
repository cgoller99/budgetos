import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";

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
  audit: [{ type: "proposed" }, { type: "approved", actor: "human-reviewer" }],
  ...overrides,
});
const run = (extra = {}) => spawnSync(process.execPath, ["scripts/jarvis-business-worker.mjs"], {
  encoding: "utf8",
  env: { ...baseEnv, ...extra },
});
const runAsync = (attempt = 0) => new Promise(resolve => {
  const child = spawn(process.execPath, ["scripts/jarvis-business-worker.mjs"], { env: baseEnv });
  let stderr = "";
  child.stderr.on("data", chunk => { stderr += chunk; });
  child.on("close", code => {
    if (code !== 0 && stderr.includes("Queue locked") && attempt < 3) {
      setTimeout(() => resolve(runAsync(attempt + 1)), 10);
    } else {
      resolve(code);
    }
  });
});

try {
  await writeFile(queue, JSON.stringify([task("one"), task("two", {
    business: "website-agency",
    businessName: "Website-building agency",
    title: "Build a landing page",
    model: { kind: "coding", model: "openai/gpt-4o-mini" },
  }), task("three", {
    business: "drivenest",
    businessName: "DriveNest Auto Care",
    title: "Review customer booking",
    model: { kind: "business", model: "openai/gpt-4o-mini" },
  }), task("unsafe", { risk: "high", title: "Send customer payment email" }), task("future", {
    scheduledAt: new Date(Date.now() + 60_000).toISOString(),
  }), task("unreviewed", { status: "proposed", reviewedAt: undefined, audit: [{ type: "proposed" }] }),
  task("unsupported", { business: "unknown-business", model: { kind: "business" } }),
  task("mismatch", {
    business: "drivenest",
    businessName: "Buxme",
    model: { kind: "business", model: "openai/gpt-4o-mini" },
  })]));

  const codes = await Promise.all([runAsync(), runAsync(), runAsync()]);
  assert.ok(codes.every(code => code === 0), codes);
  let tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks.filter(item => item.status === "completed").length, 3);
  assert.equal(tasks.find(item => item.id === "unsafe").status, "blocked");
  assert.equal(tasks.find(item => item.id === "unsupported").status, "blocked");
  assert.equal(tasks.find(item => item.id === "mismatch").status, "blocked");
  assert.equal(tasks.find(item => item.id === "future").status, "approved");
  assert.equal(tasks.find(item => item.id === "unreviewed").status, "proposed");
  for (const id of ["one", "two"]) {
    const events = tasks.find(item => item.id === id).audit.map(item => item.type);
    assert.deepEqual(events.slice(0, 4), ["proposed", "approved", "model_routed", "claimed"]);
    assert.ok(["completed", "reconciled"].includes(events.at(-1)));
  }

  const completed = tasks.find(item => item.id === "one");
  const record = JSON.parse(await readFile(join(results, `${completed.executionId}.json`), "utf8"));
  assert.equal(record.result.business, "buxme");
  assert.equal(record.result.taskId, "one");
  assert.deepEqual(record.result.sideEffects, []);
  assert.ok(Array.isArray(record.result.evidence));
  assert.equal(JSON.parse(await readFile(join(results, `${tasks.find(item => item.id === "three").executionId}.json`), "utf8")).result.handler, "drivenest.business.inventory");
  assert.equal(await readdir(results).then(items => items.length), 3);

  await writeFile(queue, JSON.stringify([task("retry")]));
  assert.notEqual(run({ JARVIS_TEST_FAIL_ONCE: "retry:1" }).status, 0);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks[0].status, "approved");
  assert.equal(tasks[0].attempts, 1);
  assert.equal(tasks[0].audit.at(-1).type, "retry_scheduled");
  assert.equal(run().status, 0);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks[0].status, "completed");
  assert.equal(tasks[0].attempts, 2);

  await writeFile(queue, JSON.stringify([task("exhausted", { attempts: 2 })]));
  assert.notEqual(run({ JARVIS_TEST_FAIL_ONCE: "exhausted:3" }).status, 0);
  tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.equal(tasks[0].status, "failed");
  assert.equal(tasks[0].attempts, 3);

  console.log("Jarvis business worker tests passed: atomic claims, isolation, approval/safety gates, results, audit, retries.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
