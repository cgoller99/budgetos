import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const run = (...args) => spawnSync(process.execPath, ["scripts/jarvis-coding-context.mjs", ...args], { encoding: "utf8" });
assert.notEqual(run("bad", "../test.env").status, 0);
assert.notEqual(run("valid-task", "test.env").status, 0);
assert.notEqual(run("valid-task", "lib/ai-team/../../test.env").status, 0);
assert.notEqual(run("valid-task", "lib/ai-team/missing-file.ts").status, 0);
console.log("Jarvis coding context safety guards passed.");
