import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const dir = await mkdtemp(join(tmpdir(), "jarvis-scheduled-dispatch-"));
const manifest = join(dir, "approved.json");
const run = () => spawnSync(
  process.execPath,
  ["scripts/jarvis-scheduled-dispatch.mjs", "--dry-run"],
  { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, JARVIS_APPROVED_TASKS_PATH: manifest } },
);

try {
  await writeFile(manifest, JSON.stringify([
    { id: "already-retried", status: "approved", attempts: 3 },
    { id: "needs-review", status: "proposed", attempts: 0 },
    { id: "first-approved", status: "approved", attempts: 0 },
    { id: "later-approved", status: "approved", attempts: 1 },
  ]));
  let result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    taskId: "first-approved",
    status: "approved",
    attempts: 0,
  });

  await writeFile(manifest, JSON.stringify([{ id: "exhausted", status: "approved", attempts: 3 }]));
  result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No new approved tasks/);

  await writeFile(manifest, JSON.stringify([{ id: "bad id", status: "approved", attempts: 0 }]));
  result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /No new approved tasks/);
  console.log("Jarvis scheduled dispatch integration test passed: selection is approved-only and attempt-bounded.");
} finally {
  await rm(dir, { recursive: true, force: true });
}
