import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const run = (...args) => spawnSync(process.execPath, ["scripts/jarvis-apply-patch.mjs", ...args], { encoding: "utf8" });
assert.notEqual(run("../escape", "no-file.json").status, 0);
assert.notEqual(run("missing-task-2026", "no-file.json").status, 0);
console.log("Jarvis patch application guards passed.");
