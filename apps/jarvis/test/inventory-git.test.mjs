import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { commitApprovedSandbox } from "../lib/gitGate.mjs";
import { readBusinessInventory } from "../lib/inventory.mjs";

const exec = promisify(execFile);

test("repository inventory stays inside the root and skips secrets", async () => {
  const root = await mkdtemp(join(tmpdir(), "jarvis-repo-"));
  await mkdir(join(root, "app"), { recursive: true });
  await writeFile(join(root, "app", "budget.ts"), "export const budget = 1;\n");
  await writeFile(join(root, ".env"), "SECRET=do-not-read\n");
  await writeFile(join(root, "app", "secrets.ts"), "export const token = 'hidden';\n");
  const inventory = await readBusinessInventory(root, "buxme");
  assert.equal(inventory.evidence.some(item => item.file.endsWith("budget.ts")), true);
  assert.equal(JSON.stringify(inventory).includes("do-not-read"), false);
  assert.equal(JSON.stringify(inventory).includes("secrets.ts"), false);
});

test("git execution is off by default and can commit only a marked sandbox", async () => {
  const calls = [];
  const disabled = await commitApprovedSandbox({
    repoDir: "/tmp/not-used",
    branch: "jarvis/disabled-test",
    message: "nope",
    files: ["note.txt"],
    allowGit: false,
    execFileImpl: async () => { calls.push("ran"); },
  });
  assert.equal(disabled.performed, false);
  assert.deepEqual(calls, []);
  const repo = await mkdtemp(join(tmpdir(), "jarvis-git-"));
  await exec("git", ["init", "-q"], { cwd: repo });
  await exec("git", ["config", "user.email", "jarvis@example.invalid"], { cwd: repo });
  await exec("git", ["config", "user.name", "Jarvis Test"], { cwd: repo });
  await writeFile(join(repo, "README.md"), "sandbox\n");
  await exec("git", ["add", "README.md"], { cwd: repo });
  await exec("git", ["commit", "-qm", "init"], { cwd: repo });
  await writeFile(join(repo, ".jarvis-sandbox"), "dedicated-jarvis-sandbox\n");
  await writeFile(join(repo, "note.txt"), "prepared note\n");
  const committed = await commitApprovedSandbox({
    repoDir: repo,
    branch: "jarvis/sandbox-note",
    message: "Prepare sandbox note",
    files: ["note.txt"],
    allowGit: true,
  });
  assert.equal(committed.performed, true);
  assert.equal(committed.pushed, false);
  assert.equal(committed.pullRequest, false);
  const log = await exec("git", ["-C", repo, "log", "--oneline"]);
  assert.match(log.stdout, /Prepare sandbox note/);
  const child = join(repo, "nested");
  await mkdir(child);
  await writeFile(join(child, ".jarvis-sandbox"), "dedicated-jarvis-sandbox\n");
  await writeFile(join(child, "note.txt"), "nested\n");
  const nested = await commitApprovedSandbox({ repoDir: child, branch: "jarvis/nested-note", message: "Do not use parent", files: ["note.txt"], allowGit: true });
  assert.equal(nested.performed, false);
  assert.match(nested.reason, /parent git repository/);
});
