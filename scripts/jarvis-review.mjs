/** Produce a bounded, offline review manifest for an isolated Jarvis task branch. */
import { spawnSync } from "node:child_process";
import { realpath, writeFile, mkdir } from "node:fs/promises";
import { resolve, join, basename, dirname } from "node:path";
const [command, taskId] = process.argv.slice(2);
if (command !== "prepare" || !/^[a-z][a-z0-9-]{2,39}$/.test(taskId ?? "")) throw new Error("Usage: node scripts/jarvis-review.mjs prepare <task-slug>");
function git(args, cwd) {
  const p = spawnSync("git", args, { cwd, encoding: "utf8", shell: false, timeout: 20000, maxBuffer: 1024 * 1024 });
  if (p.status !== 0) throw new Error(`Git failed (${args[0]}): ${(p.stderr ?? "").slice(0, 300)}`);
  return p.stdout.trim();
}
const repo = await realpath(git(["rev-parse", "--show-toplevel"], process.cwd()));
if (await realpath(process.cwd()) !== repo) throw new Error("Run from repository root.");
const branch = `jarvis/${taskId}`;
const worktree = resolve(repo, "..", `${basename(repo)}-jarvis-worktrees`, taskId);
if (git(["branch", "--list", branch], repo) !== `+ ${branch}` && !git(["branch", "--list", branch], repo).includes(branch)) throw new Error("Task branch not found.");
if (!git(["worktree", "list", "--porcelain"], repo).split("\n").some(line => line === `worktree ${worktree.replaceAll("\\", "/")}` || line === `worktree ${worktree}`)) throw new Error("Task worktree is not registered.");
if (git(["branch", "--show-current"], worktree) !== branch) throw new Error("Worktree branch mismatch.");
const changes = git(["status", "--porcelain", "--untracked-files=all"], worktree);
if (changes) throw new Error("Commit or discard all worktree changes before generating review.");
const base = git(["merge-base", "HEAD", "origin/main"], worktree);
const files = git(["diff", "--name-only", `${base}..HEAD`], worktree).split("\n").filter(Boolean);
if (files.length > 100) throw new Error("Review exceeds 100 changed files.");
const summary = git(["diff", "--stat", `${base}..HEAD`], worktree);
const commits = git(["log", "--format=%h %s", `${base}..HEAD`], worktree).split("\n").filter(Boolean);
const prohibited = files.filter(f => /(^|\/)(\.env|secrets?|credentials?)(\.|\/|$)|\.(pem|key|p12)$/i.test(f));
if (prohibited.length) throw new Error("Potential secrets in changed paths; manual review required.");
const report = { taskId, branch, baseCommit: base, headCommit: git(["rev-parse", "HEAD"], worktree), files, commits, summary, requiresHumanReview: true, merged: false, deployed: false, generatedAt: new Date().toISOString() };
const output = join(repo, "data", "jarvis-reviews", `${taskId}.json`);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + "\n", { flag: "w" });
console.log(JSON.stringify({ output, changedFiles: files.length, requiresHumanReview: true }, null, 2));

