import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = await mkdtemp(join(tmpdir(), "jarvis-guard-test-"));
const guard = join(process.cwd(), "scripts/jarvis-guard-diff.mjs");
function git(...args) {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
}
function check(allowed, message) {
  const r = spawnSync(process.execPath, [guard], {
    cwd: root, encoding: "utf8",
    env: { ...process.env, JARVIS_BASE_REF: "origin/main" }
  });
  assert.equal(r.status === 0, allowed, message + ": " + r.stderr);
}
try {
  git("init", "-q");
  git("config", "user.name", "Jarvis Guard Test");
  git("config", "user.email", "jarvis-test@example.invalid");
  await mkdir(join(root, "components"), { recursive: true });
  await writeFile(join(root, "components", "safe.tsx"), "export const x = 1;\n");
  git("add", ".");
  git("commit", "-qm", "baseline");
  git("branch", "-f", "main");
  git("remote", "add", "origin", root);
  git("fetch", "-q", "origin", "main");
  await writeFile(join(root, "components", "safe.tsx"), "export const x = 2;\n");
  git("add", ".");
  git("commit", "-qm", "safe change");
  check(true, "Safe UI change should pass");
  await mkdir(join(root, "app", "api", "stripe"), { recursive: true });
  await writeFile(join(root, "app", "api", "stripe", "route.ts"), "export const bad = true;\n");
  git("add", ".");
  git("commit", "-qm", "protected change");
  check(false, "Payment changes must be blocked");
  await writeFile(join(root, "components", "untracked.tsx"), "export const y = 1;\n");
  check(false, "Untracked files must be blocked");
  console.log("Jarvis guard tests passed: safe change, protected path, untracked files");
} finally { await rm(root, { recursive: true, force: true }); }
