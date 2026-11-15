import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const directory = await mkdtemp(join(tmpdir(), "jarvis-select-approved-task-"));
const manifestPath = join(directory, "approved.json");
const run = () => spawnSync(process.execPath, ["scripts/jarvis-select-approved-task.mjs"], {
  cwd: process.cwd(),
  encoding: "utf8",
  env: { ...process.env, JARVIS_APPROVED_TASKS_PATH: manifestPath },
});

try {
  await writeFile(manifestPath, JSON.stringify([
    { id: "zulu", status: "approved" },
    { id: "ignored", status: "proposed" },
    { id: "alpha", status: "approved" },
  ]));
  const selected = run();
  assert.equal(selected.status, 0, selected.stderr);
  assert.equal(selected.stdout.trim(), "alpha");

  await writeFile(manifestPath, JSON.stringify([{ id: "unsafe id", status: "approved" }]));
  const invalid = run();
  assert.equal(invalid.status, 0, invalid.stderr);
  assert.equal(invalid.stdout.trim(), "none");

  await writeFile(manifestPath, JSON.stringify([
    { id: "alpha", status: "approved" },
    { id: "alpha", status: "approved" },
  ]));
  const duplicate = run();
  assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.stderr, /duplicate approved task id/i);

  await writeFile(manifestPath, JSON.stringify([{ id: "ignored", status: "rejected" }]));
  const empty = run();
  assert.equal(empty.status, 0, empty.stderr);
  assert.equal(empty.stdout.trim(), "none");
  assert.equal((await readFile(manifestPath, "utf8")).includes("approved"), false);

  console.log("Jarvis approved-task selector tests passed: one deterministic, valid approved task or none.");
} finally {
  await rm(directory, { recursive: true, force: true });
}
