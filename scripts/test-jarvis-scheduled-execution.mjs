import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(".github/workflows/jarvis-scheduled-execution.yml", "utf8");
assert.match(workflow, /cron: '7,22,37,52 \* \* \* \*'/);
assert.match(workflow, /workflow_dispatch:/);
assert.match(workflow, /contents: read\s*\n  issues: write/);
assert.match(workflow, /group: jarvis-scheduled-executor/);
assert.match(workflow, /cancel-in-progress: false/);
assert.match(workflow, /timeout-minutes: 10/);
assert.match(workflow, /JARVIS_SCHEDULED_EXECUTION: "true"/);
assert.match(workflow, /node scripts\/jarvis-github-execute\.mjs/);
assert.match(workflow, /Upload execution audit/);
assert.match(workflow, /retention-days: 30/);
assert.doesNotMatch(workflow, /contents: write|actions: write|deployments: write|id-token: write/);

const executor = await readFile("scripts/jarvis-github-execute.mjs", "utf8");
assert.match(executor, /JARVIS_SCHEDULED_EXECUTION/);
assert.match(executor, /status === "approved" && !completed\.has\(x\.id\)/);
console.log("Jarvis scheduled execution integration test passed: bounded cron, concurrency, approval gate, and audit artifact.");
