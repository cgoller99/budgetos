import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { runScheduledWorker } from "../lib/jarvis/scheduledTrigger.mjs";

const child = new EventEmitter();
child.kill = signal => {
  child.killedWith = signal;
};
let spawnArgs;
const spawnProcess = (...args) => {
  spawnArgs = args;
  return child;
};

const success = runScheduledWorker({
  cwd: "test-root",
  env: { JARVIS_ACTOR: "", JARVIS_SCHEDULED_TIMEOUT_MS: "1000" },
  spawnProcess,
  timeout: 1_000,
});
assert.equal(spawnArgs[0], process.execPath);
assert.deepEqual(spawnArgs[1], ["scripts/jarvis-scheduled-worker.mjs"]);
assert.equal(spawnArgs[2].cwd, "test-root");
assert.equal(spawnArgs[2].env.JARVIS_ACTOR, "jarvis-cron-trigger");
setImmediate(() => child.emit("exit", 0, null));
assert.deepEqual(await success, { status: "completed_or_idle" });

const failureChild = new EventEmitter();
failureChild.kill = () => {};
setImmediate(() => failureChild.emit("exit", 1, null));
await assert.rejects(
  runScheduledWorker({ env: {}, spawnProcess: () => failureChild, timeout: 1_000 }),
  error => error.code === "EWORKER",
);

const timeoutChild = new EventEmitter();
timeoutChild.kill = signal => {
  timeoutChild.killedWith = signal;
};
await assert.rejects(
  runScheduledWorker({ env: {}, spawnProcess: () => timeoutChild, timeout: 1_000 }),
  error => error.code === "ETIMEDOUT",
);
assert.equal(timeoutChild.killedWith, "SIGTERM");

console.log("Jarvis scheduled trigger tests passed: one authenticated cron launch is bounded and failure-aware.");
