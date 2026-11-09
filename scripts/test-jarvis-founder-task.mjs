import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const dir = await mkdtemp(join(tmpdir(), "jarvis-brief-"));
const previous = process.cwd();
try {
  process.chdir(dir);
  for (const [task, expectedRisk] of [
    ["Improve Jarvis microphone error reporting", "routine_review"],
    ["Change Stripe payment and banking permissions", "restricted_area"]
  ]) {
    const result = spawnSync(process.execPath, [join(previous, "scripts/jarvis-capture-founder-task.mjs")], {
      env: { ...process.env, FOUNDER_TASK: task, GITHUB_STEP_SUMMARY: "" }, encoding: "utf8"
    });
    assert.equal(result.status, 0, result.stderr);
    const brief = JSON.parse(await readFile("jarvis-output/founder-task.json", "utf8"));
    assert.equal(brief.risk, expectedRisk);
    assert.equal(brief.execution, "not_started");
    assert.equal(brief.reviewRequired, true);
    assert.equal(brief.acceptanceCriteria.length, 4);
  }
  console.log("Jarvis founder task brief tests passed");
} finally {
  process.chdir(previous);
  await rm(dir, { recursive: true, force: true });
}
