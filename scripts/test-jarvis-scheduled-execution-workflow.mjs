import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(".github/workflows/jarvis-scheduled-execution.yml", "utf8");

assert.match(workflow, /cron: '7,22,37,52 \* \* \* \*'/);
assert.match(workflow, /JARVIS_AUTONOMOUS_ENABLED == 'true'/);
assert.match(workflow, /contents: read/);
assert.match(workflow, /group: jarvis-scheduled-executor/);
assert.match(workflow, /cancel-in-progress: false/);
assert.match(workflow, /timeout-minutes: 10/);
assert.match(workflow, /JARVIS_QUEUE_PATH: data\/jarvis-queue\.json/);
assert.match(workflow, /node scripts\/jarvis-scheduled-worker\.mjs/);
assert.doesNotMatch(workflow, /GITHUB_TOKEN|issues: write|actions: write/);

console.log("Jarvis scheduled execution workflow test passed: gated, serialized, read-only, bounded one-task trigger.");
