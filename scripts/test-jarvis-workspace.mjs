import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const root = await mkdtemp(join(tmpdir(), "jarvis-ws-"));
const repo = join(root, "repo");
await mkdir(repo);
const run = (cmd, args, cwd = repo) => spawnSync(cmd, args, { cwd, encoding: "utf8", shell: false });
try {
  assert.equal(run("git", ["init", "-q"]).status, 0);
  assert.equal(run("git", ["config", "user.email", "jarvis-test@example.invalid"]).status, 0);
  assert.equal(run("git", ["config", "user.name", "Jarvis Test"]).status, 0);
  await writeFile(join(repo, "README.md"), "Fixture\n");
  assert.equal(run("git", ["add", "README.md"]).status, 0);
  assert.equal(run("git", ["commit", "-qm", "fixture"]).status, 0);
  await mkdir(join(repo, "scripts"));
  await copyFile("scripts/jarvis-workspace.mjs", join(repo, "scripts/jarvis-workspace.mjs"));
  const prepared = run(process.execPath, ["scripts/jarvis-workspace.mjs", "prepare", "fix-login"]);
  assert.equal(prepared.status, 0, prepared.stderr);
  const info = JSON.parse(prepared.stdout);
  assert.equal(info.branch, "jarvis/fix-login");
  assert.equal(info.mode, "review_only");
  assert.equal(run("git", ["branch", "--show-current"]).stdout.trim().length > 0, true);
  const duplicate = run(process.execPath, ["scripts/jarvis-workspace.mjs", "prepare", "fix-login"]);
  assert.notEqual(duplicate.status, 0);
  const unsafe = run(process.execPath, ["scripts/jarvis-workspace.mjs", "prepare", "../main"]);
  assert.notEqual(unsafe.status, 0);
  console.log("Jarvis isolated coding workspace tests passed.");
} finally { await rm(root, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 }); }

