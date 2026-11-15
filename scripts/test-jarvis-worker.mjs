import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { handlersFor, runWorker } from "../lib/jarvis/worker.mjs";

const dir = await mkdtemp(join(tmpdir(), "jarvis-worker-"));
const queuePath = join(dir, "queue.json");
const resultDir = join(dir, "results");
const approved = (overrides = {}) => ({
  id: "buxme-research", title: "Research conversion", business: "buxme",
  status: "approved", attempts: 0, risk: "low", model: { kind: "research" },
  createdAt: "2026-11-15T07:00:00.000Z", reviewedAt: "2026-11-15T07:01:00.000Z",
  audit: [{ type: "proposed" }, { type: "approved" }], ...overrides,
});
const run = (handlers, now = () => Date.parse("2026-11-15T07:02:00.000Z")) =>
  runWorker({ queuePath, resultDir, root: dir, handlers, now });

try {
  await mkdir(join(dir, "app"));
  await writeFile(join(dir, "app", "conversion.mjs"), "export const conversion = true;\n");
  const realResult = await handlersFor()["buxme:research"]({ root: dir });
  assert.equal(realResult.handler, "buxme-conversion-inventory");
  assert.equal(realResult.matches[0].file, "app/conversion.mjs");

  await writeFile(queuePath, JSON.stringify([
    approved(),
    approved({ id: "future", scheduledAt: "2026-11-15T08:00:00.000Z" }),
    approved({ id: "high-risk", risk: "high" }),
    { ...approved({ id: "unapproved" }), status: "proposed", reviewedAt: undefined, audit: [{ type: "proposed" }] },
  ]));
  const calls = [];
  const handlers = { "buxme:research": async ({ task }) => { calls.push(task.business); return { action: "conversion-inventory", evidence: ["local-only"] }; } };
  let outcome = await run(handlers);
  assert.equal(outcome.status, "completed");
  assert.deepEqual(calls, ["buxme"]);
  let tasks = JSON.parse(await readFile(queuePath, "utf8"));
  assert.equal(tasks[0].status, "completed");
  assert.equal(tasks[1].status, "approved");
  assert.equal(tasks[2].status, "approved");
  assert.equal(tasks[3].status, "proposed");
  assert.deepEqual(tasks[0].audit.map(event => event.type), ["proposed", "approved", "claimed", "completed"]);
  const record = JSON.parse(await readFile(join(resultDir, `${tasks[0].executionId}.json`), "utf8"));
  assert.equal(record.business, "buxme");
  assert.equal(record.result.action, "conversion-inventory");

  await writeFile(queuePath, JSON.stringify([approved({ id: "retry-me" })]));
  let fail = true;
  const flaky = { "buxme:research": async () => {
    if (fail) { fail = false; throw new Error("bounded test failure"); }
    return { action: "retry-success" };
  } };
  outcome = await run(flaky);
  assert.equal(outcome.status, "failed");
  tasks = JSON.parse(await readFile(queuePath, "utf8"));
  assert.equal(tasks[0].status, "approved");
  assert.equal(tasks[0].attempts, 1);
  assert.equal(tasks[0].audit.at(-1).type, "failed");
  assert.ok(tasks[0].nextAttemptAt);
  outcome = await run(flaky, () => Date.parse(tasks[0].nextAttemptAt) + 1);
  assert.equal(outcome.status, "completed");
  tasks = JSON.parse(await readFile(queuePath, "utf8"));
  assert.equal(tasks[0].attempts, 2);
  assert.deepEqual(tasks[0].audit.map(event => event.type), ["proposed", "approved", "claimed", "failed", "claimed", "completed"]);

  await writeFile(queuePath, JSON.stringify([approved({ id: "exhaust-retries" })]));
  const alwaysFails = { "buxme:research": async () => { throw new Error("permanent test failure"); } };
  for (let attempt = 1; attempt <= 3; attempt++) {
    outcome = await run(alwaysFails, () => Date.parse(tasks[0]?.nextAttemptAt ?? "2026-11-15T07:02:00.000Z") + 1);
    assert.equal(outcome.status, "failed");
    tasks = JSON.parse(await readFile(queuePath, "utf8"));
    assert.equal(tasks[0].attempts, attempt);
    if (attempt < 3) assert.equal(tasks[0].status, "approved");
  }
  assert.equal(tasks[0].status, "failed");
  assert.equal(tasks[0].nextAttemptAt, undefined);
  assert.equal(tasks[0].audit.filter(event => event.type === "failed").length, 3);

  await writeFile(queuePath, JSON.stringify([approved({ id: "isolated", business: "drivenest", model: { kind: "research" } })]));
  outcome = await run({ "buxme:research": async () => ({ action: "wrong-business" }) });
  assert.equal(outcome.status, "idle");
  console.log("Jarvis persistent worker tests passed: due approval gate, business isolation, results, audit, retries.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
