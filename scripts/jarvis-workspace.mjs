/** Prepare isolated, review-only Git worktrees for Jarvis coding tasks. */
import { spawnSync } from "node:child_process";
import { resolve, join, basename } from "node:path";
import { mkdir, realpath } from "node:fs/promises";
const [command, taskId] = process.argv.slice(2);
function git(args, cwd = process.cwd()) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", shell: false, timeout: 20000 });
  if (result.status !== 0) throw new Error(`Git operation failed: ${args[0]} ${args[1] ?? ""}: ${(result.stderr ?? "").slice(0, 400)}`);
  return result.stdout.trim();
}
if (command !== "prepare" || !/^[a-z][a-z0-9-]{2,39}$/.test(taskId ?? "")) {
  throw new Error("Usage: node scripts/jarvis-workspace.mjs prepare <lowercase-task-slug>");
}
const repo = await realpath(git(["rev-parse", "--show-toplevel"]));
const current = await realpath(process.cwd());
if (current !== repo) throw new Error("Run from the repository root.");
const branch = `jarvis/${taskId}`;
const parent = resolve(repo, "..", `${basename(repo)}-jarvis-worktrees`);
const destination = join(parent, taskId);
if (git(["branch", "--list", branch])) throw new Error("Task branch already exists.");
if (git(["status", "--porcelain", "--untracked-files=no"])) throw new Error("Tracked working tree must be clean.");
await mkdir(parent, { recursive: true });
git(["worktree", "add", "-b", branch, destination, "HEAD"]);
console.log(JSON.stringify({ branch, workspace: destination, mode: "review_only", next: "Edit only inside workspace, run tests, and request review before merging or deploying." }, null, 2));

