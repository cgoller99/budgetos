import assert from "node:assert/strict";
import test from "node:test";
import { emptyState } from "../lib/store.mjs";
import { createTask, reviewTask, suggestTasks } from "../lib/taskQueue.mjs";

test("task review records approval and does not perform the task", () => {
  const state = emptyState("2026-11-21");
  const task = createTask(state, { title: "Purchase ads for DriveNest", business: "drivenest" }, {});
  assert.equal(task.status, "proposed");
  assert.equal(task.risk, "high");
  assert.deepEqual(task.externalSideEffects, []);
  const approved = reviewTask(state, task.id, "approved");
  assert.equal(approved.status, "approved");
  assert.deepEqual(approved.externalSideEffects, []);
  assert.equal(approved.result, undefined);
  assert.throws(() => reviewTask(state, task.id, "approved"), /Only a proposed task/);
});

test("suggestions invent no metrics", () => {
  const state = emptyState("2026-11-21");
  const suggestions = suggestTasks(state, {});
  const body = JSON.stringify(suggestions);
  assert.equal(body.includes("$"), false);
  assert.match(body, /Connect read-only Buxme metrics/);
});
