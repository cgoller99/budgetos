/** Run a fixed, non-AI verification suite inside a registered Jarvis worktree. */
import { spawnSync } from "node:child_process";
import { resolve, basename, join } from "node:path";
import { realpath, writeFile, mkdir } from "node:fs/promises";
const [taskId] = process.argv.slice(2);
if (!/^[a-z][a-z0-9-]{2,39}$/.test(taskId ?? "")) throw Error("Usage: node scripts/jarvis-verify.mjs <task-slug>");
function run(cmd, args, cwd, timeout = 20000) {
  return spawnSync(cmd, args, { cwd, encoding: "utf8", shell: false, timeout, maxBuffer: 256 * 1024 });
}
const repoResult = run("git", ["rev-parse", "--show-toplevel"], process.cwd());
if (repoResult.status !== 0) throw Error("Not a Git repository.");
const repo = await realpath(repoResult.stdout.trim());
if (repo !== await realpath(process.cwd())) throw Error("Run from repository root.");
const worktree = resolve(repo, "..", `${basename(repo)}-jarvis-worktrees`, taskId);
const registered = run("git", ["worktree", "list", "--porcelain"], repo);
if (registered.status !== 0 || !registered.stdout.split(/\r?\n/).some(line => line.replaceAll("\\", "/") === `worktree ${worktree.replaceAll("\\", "/")}`)) throw Error("Unregistered task worktree.");
const branch = run("git", ["branch", "--show-current"], worktree);
if (branch.status !== 0 || branch.stdout.trim() !== `jarvis/${taskId}`) throw Error("Task branch mismatch.");
const commands = [["node", ["scripts/test-jarvis-task-queue.mjs"]], ["node", ["scripts/test-jarvis-workspace.mjs"]], ["node", ["scripts/test-jarvis-review.mjs"]]];
const results = [];
for (const [cmd, args] of commands) {
  const result = run(cmd, args, worktree, 60000);
  results.push({ command: [cmd, ...args].join(" "), passed: result.status === 0, exitCode: result.status, outputTail: (result.stdout ?? "").slice(-1000), errorTail: (result.stderr ?? "").slice(-1000) });
  if (result.status !== 0) break;
}
const head = run("git", ["rev-parse", "HEAD"], worktree);
if (head.status !== 0 || !/^[a-f0-9]{40}$/.test(head.stdout.trim())) throw Error("Unable to identify verified commit.");
const report = { taskId, headCommit: head.stdout.trim(), branch: `jarvis/${taskId}`, generatedAt: new Date().toISOString(), results, passed: results.length === commands.length && results.every(r => r.passed), approvalRequired: true };
const destination = join(repo, "data", "jarvis-verifications");
await mkdir(destination, { recursive: true });
await writeFile(join(destination, `${taskId}.json`), JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ taskId, passed: report.passed, checks: results.length }));
if (!report.passed) process.exitCode = 1;

