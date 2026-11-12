import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(".github/workflows/jarvis-safe-execution.yml", "utf8");
const lines = workflow.split(/\r?\n/);
assert.match(workflow, /^on:\s*\n  workflow_dispatch:\s*\n/m, "Must be manually dispatched");
assert.doesNotMatch(workflow, /^\s*(schedule|push|pull_request|workflow_run|repository_dispatch):/m, "No automatic execution triggers");
assert.match(workflow, /approved_task_id:\s*\n\s*description:[^\n]*\n\s*required: true/, "Explicit task ID must be required");
assert.match(workflow, /^    environment: jarvis-coding$/m, "Must use protected environment");
assert.match(workflow, /^permissions:\s*\n  contents: read\s*\n  issues: write/m, "Restrict GitHub token permissions");
assert.doesNotMatch(workflow, /^\s*(contents: write|actions: write|deployments: write|id-token: write|packages: write)\s*$/m);
assert.match(workflow, /JARVIS_APPROVED_TASK_ID: \$\{\{ inputs\.approved_task_id \}\}/);
assert.match(workflow, /node scripts\/test-jarvis-github-execute\.mjs/);
assert.match(workflow, /run: node scripts\/jarvis-github-execute\.mjs/);
assert.equal(lines.filter(x => /^    environment:/.test(x)).length, 1);
console.log("Jarvis workflow policy passed: manual-only, required ID, protected environment, scoped token.");
