import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(".github/workflows/jarvis-scheduled-execution.yml", "utf8");

assert.match(workflow, /schedule:\s*\n\s+- cron: ["']\*\/15 \* \* \* \*["']/);
assert.match(workflow, /workflow_dispatch:/);
assert.match(workflow, /contents: read/);
assert.doesNotMatch(workflow, /contents: write|issues: write|pull-requests: write/);
assert.match(workflow, /group: jarvis-scheduled-execution/);
assert.match(workflow, /cancel-in-progress: false/);
assert.match(workflow, /timeout-minutes: 10/);
assert.match(workflow, /if: vars\.JARVIS_AUTONOMOUS_EXECUTION_ENABLED == 'true'/);
assert.match(workflow, /node scripts\/jarvis-scheduled-worker\.mjs/);
assert.match(workflow, /--kill-after=30s 8m/);
assert.match(workflow, /JARVIS_QUEUE_PATH: data\/jarvis-queue\.json/);
assert.match(workflow, /JARVIS_RESULTS_DIR: \$\{\{ runner\.temp \}\}\/jarvis-results/);
assert.match(workflow, /actions\/upload-artifact@v4/);
assert.match(workflow, /retention-days: 30/);
assert.match(workflow, /persist-credentials: false/);

console.log("Jarvis scheduled execution workflow tests passed: opt-in, serialized, bounded, read-only, and audited.");
