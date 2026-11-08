import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const run = (...args) => spawnSync(process.execPath, ["scripts/jarvis-pr-draft.mjs", ...args], { encoding: "utf8" });
assert.notEqual(run("../escape").status, 0);
assert.notEqual(run("nonexistent-task-2026").status, 0);
console.log("Jarvis PR draft safety guards passed.");
