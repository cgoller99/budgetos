import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const run = (...args) => spawnSync(process.execPath, ["scripts/jarvis-publish-pr.mjs", ...args], { encoding: "utf8", env: { ...process.env, JARVIS_PR_PUBLISH_ENABLED: "false" } });
assert.notEqual(run("../unsafe").status, 0);
assert.notEqual(run("nonexistent-task-2026").status, 0);
console.log("Jarvis PR publication safety guards passed.");
