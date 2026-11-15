import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(".github/workflows/jarvis-scheduled-execution.yml", "utf8");
assert.match(workflow, /cron: '12,27,42,57 \* \* \* \*'/);
assert.match(workflow, /concurrency:\s*\n  group: jarvis-scheduled-executor/);
assert.match(workflow, /timeout-minutes: 10/);
assert.match(workflow, /run: node scripts\/jarvis-scheduled-worker\.mjs/);
assert.match(workflow, /JARVIS_ACTOR: jarvis-github-scheduled-worker/);
assert.doesNotMatch(workflow, /GITHUB_TOKEN|issues: write/);
console.log("Jarvis scheduled execution workflow policy passed: staggered, bounded, single-worker, read-only trigger.");
