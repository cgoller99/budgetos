import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(".github/workflows/jarvis-scheduled-business-execution.yml", "utf8");

assert.match(workflow, /cron: '7,22,37,52 \* \* \* \*'/);
assert.match(workflow, /workflow_dispatch:/);
assert.match(workflow, /permissions:\s*\n  contents: read/);
assert.match(workflow, /group: jarvis-scheduled-business-executor/);
assert.match(workflow, /cancel-in-progress: false/);
assert.match(workflow, /timeout-minutes: 10/);
assert.match(workflow, /JARVIS_ACTOR: jarvis-scheduled-business-executor/);
assert.match(workflow, /node scripts\/jarvis-scheduled-worker\.mjs/);
assert.match(workflow, /Upload execution audit/);
assert.match(workflow, /retention-days: 30/);
assert.doesNotMatch(workflow, /contents: write|actions: write|issues: write|deployments: write|id-token: write/);

console.log("Jarvis scheduled business execution policy passed: bounded cron, serialized runs, read-only permissions, and audit retention.");
