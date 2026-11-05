import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const dir = await mkdtemp(join(tmpdir(), "jarvis-test-"));
try {
  const input = join(dir, "signals.json");
  const output = join(dir, "report.json");
  await writeFile(input, JSON.stringify([{ id: "auth", title: "Investigate login errors", source: "reliability", severity: 5, affectedUsers: 5, confidence: 0.95, evidence: ["Error counter"], proposedAction: "Review error logs" }]));
  const run = spawnSync(process.execPath, ["scripts/jarvis-priority-worker.mjs", input, output], { cwd: process.cwd(), encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  const report = JSON.parse(await readFile(output, "utf8"));
  assert.equal(report.mode, "proposal_only");
  assert.equal(report.priorities[0].id, "auth");
  assert.equal(report.priorities[0].execution, "proposal_only");
  console.log("Jarvis priority worker integration test passed.");
} finally { await rm(dir, { recursive: true, force: true }); }
