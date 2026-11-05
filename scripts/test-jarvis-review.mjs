import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
const root = await mkdtemp(join(tmpdir(), "jarvis-review-test-"));
const repo = join(root, "repo");
await mkdir(repo);
const run = (cmd, args, cwd = repo) => spawnSync(cmd, args, { cwd, encoding: "utf8", shell: false });
try {
  for (const args of [["init", "-q", "-b", "main"], ["config", "user.email", "jarvis@example.invalid"], ["config", "user.name", "Jarvis"]]) assert.equal(run("git", args).status, 0);
  await writeFile(join(repo, "README.md"), "Fixture\n");
  assert.equal(run("git", ["add", "."]).status, 0);
  assert.equal(run("git", ["commit", "-qm", "initial"]).status, 0);
  await mkdir(join(repo, "scripts"));
  await copyFile("scripts/jarvis-review.mjs", join(repo, "scripts/jarvis-review.mjs"));
  const worktree = join(root, "repo-jarvis-worktrees", "fix-auth");
  assert.equal(run("git", ["worktree", "add", "-b", "jarvis/fix-auth", worktree, "HEAD"]).status, 0);
  await writeFile(join(worktree, "fix.txt"), "Fix\n");
  assert.equal(run("git", ["add", "fix.txt"], worktree).status, 0);
  assert.equal(run("git", ["commit", "-qm", "fix auth"], worktree).status, 0);
  const review = run(process.execPath, ["scripts/jarvis-review.mjs", "prepare", "fix-auth"]);
  assert.equal(review.status, 0, review.stderr);
  const report = JSON.parse(await readFile(join(repo, "data", "jarvis-reviews", "fix-auth.json"), "utf8"));
  assert.deepEqual(report.files, ["fix.txt"]);
  assert.equal(report.requiresHumanReview, true);
  assert.equal(report.deployed, false);
  console.log("Jarvis review manifest test passed.");
} finally { await rm(root, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 }); }
