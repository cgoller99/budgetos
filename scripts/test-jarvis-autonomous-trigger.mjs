import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const dir = await mkdtemp(join(tmpdir(), "jarvis-autonomous-trigger-"));
const queue = join(dir, "queue.json");
const results = join(dir, "results");
const audit = join(dir, "scheduler-runs.jsonl");
const env = {
  ...process.env,
  JARVIS_QUEUE_PATH: queue,
  JARVIS_RESULTS_DIR: results,
  JARVIS_RUN_AUDIT_PATH: audit,
  JARVIS_ACTOR: "trigger-test",
  JARVIS_MAX_TASKS: "99",
  JARVIS_RESEARCH_MODEL: "anthropic/claude-sonnet-4",
};
const workflow = await readFile(".github/workflows/jarvis-autonomous-trigger.yml", "utf8");
assert.match(workflow, /cron: '12,27,42,57 \* \* \* \*'/);
assert.match(workflow, /^permissions:\s*\n  contents: read$/m);
assert.doesNotMatch(workflow, /contents: write|issues: write|actions: write/);
assert.match(workflow, /concurrency:\s*\n  group: jarvis-autonomous-trigger/);
assert.match(workflow, /JARVIS_MAX_TASKS: '1'/);
const task = (id, title, business, businessName) => ({
  id,
  title,
  business,
  businessName,
  status: "approved",
  reviewedAt: new Date().toISOString(),
  attempts: 0,
  risk: "low",
  model: { kind: "research", model: "openai/gpt-4o-mini" },
  audit: [
    { type: "proposed", actor: "founder" },
    { type: "approved", actor: "reviewer" },
  ],
});

const run = () => spawnSync(process.execPath, ["scripts/jarvis-autonomous-trigger.mjs"], {
  cwd: process.cwd(),
  encoding: "utf8",
  env,
});

try {
  await writeFile(queue, JSON.stringify([
    task("buxme-audit", "Review budget transactions", "buxme", "Buxme"),
    task("agency-audit", "Review landing page conversion", "website-agency", "Website-building agency"),
    task("drivenest-audit", "Review vehicle service schedule", "drivenest", "DriveNest Auto Care"),
  ]));
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout.trim());
  assert.equal(summary.executed, 3);
  assert.equal(summary.maxTasks, 3, "per-run cap must remain bounded");

  const tasks = JSON.parse(await readFile(queue, "utf8"));
  assert.deepEqual(tasks.map(item => item.status), ["completed", "completed", "completed"]);
  assert.ok(tasks.every(item => item.audit.at(-1).type === "completed"));

  const entries = (await readFile(audit, "utf8")).trim().split(/\r?\n/).map(JSON.parse);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].status, "completed");
  assert.equal(entries[0].tasks.length, 3);
  assert.equal(entries[0].actor, "trigger-test");

  const idle = run();
  assert.equal(idle.status, 0, idle.stderr);
  const allEntries = (await readFile(audit, "utf8")).trim().split(/\r?\n/).map(JSON.parse);
  assert.equal(allEntries.length, 2);
  assert.equal(allEntries[1].tasks.at(-1).status, "idle");
  console.log("Jarvis autonomous trigger integration test passed: approval-gated work is bounded and run-audited.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
