import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const run = (...args) => spawnSync(process.execPath, ["scripts/jarvis-generate-patch.mjs", ...args], { encoding: "utf8", env: { ...process.env, JARVIS_CODING_ENABLED: "false" } });
assert.notEqual(run("../bad", "openai/model").status, 0);
assert.notEqual(run("valid-task", "badmodel").status, 0);
assert.match(run("valid-task", "openai/model", "Fix a specific isolated regression in this source file").stderr, /disabled/);
console.log("Jarvis coding model fail-closed tests passed.");

