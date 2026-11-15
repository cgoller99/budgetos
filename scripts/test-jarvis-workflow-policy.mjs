import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(".github/workflows/jarvis-safe-execution.yml", "utf8");
const lines = workflow.split(/\r?\n/);
assert.match(workflow, /^on:\s*\n  workflow_dispatch:\s*\n/m, "Manual dispatch must remain available");
assert.match(workflow, /^\s+schedule:\s*\n\s+- cron: '12,42 \* \* \* \*'/m, "Unattended trigger must be bounded to two runs per hour");
assert.match(workflow, /approved_task_id:\s*\n\s*description:[^\n]*\n\s*required: true/, "Manual runs must require an explicit task ID");
assert.match(workflow, /^    environment: jarvis-coding$/m, "Must use protected environment");
assert.match(workflow, /^permissions:\s*\n  contents: read\s*\n  issues: write/m, "Restrict GitHub token permissions");
assert.doesNotMatch(workflow, /^\s*(contents: write|actions: write|deployments: write|id-token: write|packages: write)\s*$/m);
assert.match(workflow, /JARVIS_APPROVED_TASK_ID: \$\{\{ steps\.select\.outputs\.task_id \}\}/);
assert.match(workflow, /node scripts\/jarvis-select-approved-task\.mjs/);
assert.match(workflow, /if: steps\.select\.outputs\.task_id != ''/);
assert.match(workflow, /node scripts\/test-jarvis-github-execute\.mjs/);
assert.match(workflow, /run: node scripts\/jarvis-github-execute\.mjs/);
assert.equal(lines.filter(x => /^    environment:/.test(x)).length, 1);
console.log("Jarvis workflow policy passed: bounded unattended trigger, approval selection, protected environment, scoped token.");
