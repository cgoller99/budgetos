import assert from "node:assert/strict";
import { approvedRouteFor, dispatchPlan } from "../lib/jarvis/executionRouter.mjs";

const task = {
  id: "router-test",
  business: "buxme",
  businessName: "Buxme",
  model: { kind: "research", model: "openai/gpt-4o-mini", configured: false },
};

assert.deepEqual(approvedRouteFor(task), task.model);
assert.equal(typeof dispatchPlan(task).handler, "function");
assert.throws(
  () => approvedRouteFor({ ...task, model: { kind: "research", model: "invalid model" } }),
  /Invalid Jarvis model/,
);
assert.throws(
  () => dispatchPlan({ ...task, business: "drivenest" }),
  /No business handler registered/,
);
console.log("Jarvis execution router passed: approved route validation and business dispatch isolation.");
