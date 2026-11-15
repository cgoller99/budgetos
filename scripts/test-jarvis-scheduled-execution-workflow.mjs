import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(".github/workflows/jarvis-scheduled-execution.yml", "utf8");

assert.match(workflow, /cron: '7,22,37,52 \* \* \* \*'/);
assert.match(workflow, /workflow_dispatch:/);
assert.match(workflow, /JARVIS_AUTONOMOUS_EXECUTION_ENABLED == 'true'/);
assert.match(workflow, /contents: read/);
assert.match(workflow, /persist-credentials: false/);
assert.match(workflow, /group: jarvis-scheduled-executor/);
assert.match(workflow, /cancel-in-progress: false/);
assert.match(workflow, /timeout-minutes: 10/);
assert.match(workflow, /node scripts\/jarvis-scheduled-worker\.mjs/);
assert.match(workflow, /JARVIS_QUEUE_PATH: data\/jarvis-queue\.json/);
assert.match(workflow, /JARVIS_RESULTS_DIR: \$\{\{ runner\.temp \}\}\/jarvis-results/);
assert.match(workflow, /actions\/upload-artifact@v4/);
assert.match(workflow, /retention-days: 30/);
assert.doesNotMatch(workflow, /GITHUB_TOKEN|contents: write|issues: write|actions: write/);

console.log("Jarvis scheduled execution workflow test passed: opt-in, serialized, bounded, read-only, and audited.");
