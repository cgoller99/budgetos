import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(".github/workflows/jarvis-scheduled-execution.yml", "utf8");

assert.match(workflow, /schedule:\s*\n\s+- cron: ["']\*\/10 \* \* \* \*["']/);
assert.match(workflow, /workflow_dispatch:/);
assert.match(workflow, /contents: read/);
assert.match(workflow, /group: jarvis-scheduled-execution/);
assert.match(workflow, /cancel-in-progress: false/);
assert.match(workflow, /timeout-minutes: 5/);
assert.match(workflow, /node scripts\/jarvis-scheduled-worker\.mjs/);
assert.match(workflow, /JARVIS_QUEUE_PATH: \$\{\{ runner\.temp \}\}\/jarvis-queue\.json/);
assert.match(workflow, /printf '\[\]\\n' > "\$JARVIS_QUEUE_PATH"/);
assert.match(workflow, /node scripts\/test-jarvis-scheduled-worker\.mjs/);
assert.doesNotMatch(workflow, /contents: write|issues: write|pull-requests: write/);

console.log("Jarvis scheduled execution workflow tests passed.");
