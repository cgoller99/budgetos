import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../lib/app.mjs";
import { chooseNext } from "../lib/planner.mjs";
import { createTask, reviewTask } from "../lib/worker.mjs";

test("an open task is not proposed twice", () => {
  const state = { tasks: [], logs: [] };
  const first = createTask(state, { title: "Prepare scanner notes", business: "drivenest" }, {});
  const second = createTask(state, { title: "Prepare scanner notes", business: "drivenest" }, {});
  assert.equal(second.id, first.id);
  assert.equal(state.tasks.length, 1);
  reviewTask(state, first.id, "rejected");
  const third = createTask(state, { title: "Prepare scanner notes", business: "drivenest" }, {});
  assert.notEqual(third.id, first.id);
  assert.equal(state.tasks.length, 2);
});

test("a reply waits on Christian before any approved work runs", () => {
  const choice = chooseNext({
    drafts: [{ status: "needs-christian", title: "Reply to Northline Dental" }],
    tasks: [{ status: "approved", risk: "low", title: "Prepare notes" }],
    issues: [{ status: "open", title: "Late shipment" }],
  }, new Date("2026-11-26T12:00:00Z"));
  assert.equal(choice.action, "reply");
  assert.match(choice.summary, /Nothing will be sent/);
});

test("the daily check completes one approved task and does not repeat it", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-next-"));
  const app = createApp({ dataDir: dir, env: {} });
  await app.store.update("2026-11-26", state => {
    const task = createTask(state, { title: "Prepare scanner notes", business: "drivenest", detail: "Red V410. Supplier cost is unknown." }, {});
    reviewTask(state, task.id, "approved");
  });
  const first = await app.collectInbox();
  const second = await app.collectInbox();
  assert.equal(first.run.action, "approved");
  assert.equal(first.sent, false);
  assert.equal(first.worker.completed.length, 1);
  assert.equal(second.worker.completed.length, 0);
  const saved = await app.store.read("2026-11-26");
  assert.equal(saved.tasks.filter(task => task.status === "completed").length, 1);
  assert.deepEqual(saved.tasks[0].externalSideEffects, []);
});

test("a high-risk approval is blocked once and does not purchase anything", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jarvis-risk-"));
  const app = createApp({ dataDir: dir, env: {} });
  await app.store.update("2026-11-26", state => {
    const task = createTask(state, { title: "Purchase a scanner", business: "drivenest", detail: "Do not buy it." }, {});
    reviewTask(state, task.id, "approved");
  });
  const first = await app.collectInbox();
  const second = await app.collectInbox();
  assert.equal(first.worker.blocked.length, 1);
  assert.equal(second.worker.blocked.length, 0);
  const saved = await app.store.read("2026-11-26");
  assert.equal(saved.tasks[0].status, "blocked");
  assert.deepEqual(saved.tasks[0].externalSideEffects, []);
});
