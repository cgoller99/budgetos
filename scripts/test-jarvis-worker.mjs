import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runOnce } from "../lib/jarvis/taskWorker.mjs";
import { taskHandlers } from "../lib/jarvis/taskHandlers.mjs";

const dir = await mkdtemp(join(tmpdir(), "jarvis-worker-"));
const queuePath = join(dir, "queue.json");
const resultDir = join(dir, "results");
const future = new Date(Date.now() + 60_000).toISOString();
const task = (id, business, kind, overrides = {}) => ({
  id, title: `${business} task`, business, status: "approved", attempts: 0,
  risk: "low", priority: 0, model: { kind, model: "test/local" }, createdAt: new Date().toISOString(),
  audit: [{ type: "approved", event: "approved", at: new Date().toISOString() }],
  ...overrides,
});

try {
  await writeFile(queuePath, JSON.stringify([
    task("buxme-research", "buxme", "research", { priority: 2 }),
    task("agency-code", "website-agency", "coding", { priority: 1 }),
    task("future", "drivenest", "business", { scheduledAt: future }),
    task("needs-approval", "drivenest", "business", { status: "proposed" }),
    task("high-risk", "buxme", "research", { risk: "high" }),
    task("unknown-handler", "drivenest", "routine"),
  ]));

  let result = await runOnce({ queuePath, resultDir, rootDir: process.cwd(), handlers: taskHandlers });
  assert.equal(result.status, "completed");
  assert.equal(result.business, "buxme");
  let tasks = JSON.parse(await readFile(queuePath, "utf8"));
  const completed = tasks.find(item => item.id === "buxme-research");
  assert.equal(completed.status, "completed");
  assert.equal(completed.handler, "buxme:research");
  assert.deepEqual(completed.audit.map(item => item.event), ["approved", "claimed", "completed"]);
  const record = JSON.parse(await readFile(join(resultDir, `${completed.executionId}.json`), "utf8"));
  assert.equal(record.business, "buxme");
  assert.equal(record.result.scope, "buxme-product");
  assert.equal(record.result.mode, "local-read-only");

  result = await runOnce({ queuePath, resultDir, rootDir: process.cwd(), handlers: taskHandlers });
  assert.equal(result.business, "website-agency");
  tasks = JSON.parse(await readFile(queuePath, "utf8"));
  assert.equal(tasks.find(item => item.id === "future").status, "approved");
  assert.equal(tasks.find(item => item.id === "needs-approval").status, "proposed");
  assert.equal(tasks.find(item => item.id === "high-risk").status, "blocked");
  assert.equal(tasks.find(item => item.id === "unknown-handler").status, "blocked");
  assert.equal(tasks.find(item => item.id === "high-risk").audit.at(-1).event, "blocked");
  assert.equal((await readdir(resultDir)).length, 2);

  const retryTask = task("retry-me", "buxme", "business");
  await writeFile(queuePath, JSON.stringify([retryTask]));
  const failingHandlers = { buxme: { business: async () => { throw new Error("handler failure"); } } };
  for (let attempt = 1; attempt <= 3; attempt++) {
    result = await runOnce({ queuePath, resultDir, handlers: failingHandlers });
    assert.equal(result.status, "failed");
    tasks = JSON.parse(await readFile(queuePath, "utf8"));
    assert.equal(tasks[0].attempts, attempt);
    assert.equal(tasks[0].status, attempt < 3 ? "approved" : "failed");
  }
  assert.deepEqual(tasks[0].audit.map(item => item.event), [
    "approved", "claimed", "retry_scheduled", "claimed", "retry_scheduled",
    "claimed", "failed",
  ]);
  console.log("Jarvis worker tests passed: approval gate, due claims, business handlers, results, audit, retries.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
