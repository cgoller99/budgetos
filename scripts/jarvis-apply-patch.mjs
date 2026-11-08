/** Apply a strictly bounded, review-only AI patch proposal in a registered task worktree. */
import { spawnSync } from "node:child_process";
import { readFile, writeFile, realpath } from "node:fs/promises";
import { resolve, join, basename, relative } from "node:path";
const [taskId, proposalPath] = process.argv.slice(2);
if (!/^[a-z][a-z0-9-]{2,39}$/.test(taskId ?? "") || !proposalPath) throw Error("Usage: node scripts/jarvis-apply-patch.mjs <task-slug> <proposal.json>");
const repo = await realpath(process.cwd());
function git(args, cwd = repo) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", shell: false, timeout: 20000 });
  if (result.status !== 0) throw Error("Git validation failed: " + args[0]);
  return result.stdout.trim();
}
if (await realpath(git(["rev-parse", "--show-toplevel"])) !== repo) throw Error("Run from repository root.");
const worktree = resolve(repo, "..", `${basename(repo)}-jarvis-worktrees`, taskId);
const registered = git(["worktree", "list", "--porcelain"]).split(/\r?\n/).some(line => line.replaceAll("\\", "/").toLowerCase() === `worktree ${worktree.replaceAll("\\", "/").toLowerCase()}`);
if (!registered || git(["branch", "--show-current"], worktree) !== `jarvis/${taskId}`) throw Error("Unregistered or mismatched worktree.");
if (git(["status", "--porcelain"], worktree)) throw Error("Worktree must be clean before applying proposal.");
const proposal = JSON.parse(await readFile(resolve(proposalPath), "utf8"));
if (proposal.taskId !== taskId || !Array.isArray(proposal.edits) || proposal.edits.length < 1 || proposal.edits.length > 5) throw Error("Invalid proposal.");
const updates = [];
let total = 0;
const seen = new Set();
for (const edit of proposal.edits) {
  const p = edit.path;
  if (typeof p !== "string" || !/^(app|lib|components)\/[a-zA-Z0-9_./-]+\.(ts|tsx|js)$/.test(p) || p.split("/").some(x => x === "." || x === "..") || /(^|\/)(\.env|secrets?|credentials?|node_modules)(\/|\.|$)/i.test(p) || seen.has(p)) throw Error("Unsafe or repeated source path.");
  seen.add(p);
  if (typeof edit.find !== "string" || typeof edit.replace !== "string" || !edit.find || edit.find.length > 5000 || edit.replace.length > 5000) throw Error("Invalid bounded edit.");
  const tracked = git(["ls-files", "--error-unmatch", "--", p], worktree);
  if (tracked.replaceAll("\\", "/") !== p) throw Error("Only tracked source files can be edited.");
  const full = await realpath(join(worktree, p));
  if (relative(worktree, full).startsWith("..")) throw Error("Path escapes worktree.");
  const old = await readFile(full, "utf8");
  if (old.length > 100000 || old.indexOf(edit.find) < 0 || old.indexOf(edit.find) !== old.lastIndexOf(edit.find)) throw Error("Edit anchor must occur exactly once.");
  const next = old.replace(edit.find, () => edit.replace);
  total += Math.abs(next.length - old.length) + edit.find.length;
  if (total > 15000) throw Error("Total patch size exceeded.");
  updates.push({ full, next });
}
for (const update of updates) await writeFile(update.full, update.next, "utf8");
console.log(JSON.stringify({ taskId, changedFiles: updates.length, mode: "uncommitted_review_only", next: "Inspect diff and test before commit/review. No automatic push, merge, or deployment." }));
