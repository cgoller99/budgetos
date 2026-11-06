/** Publish a verified Jarvis review as a GitHub draft PR, never merge. */
import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
const [taskId] = process.argv.slice(2);
if (!/^[a-z][a-z0-9-]{2,39}$/.test(taskId ?? "")) throw Error("Usage: node scripts/jarvis-publish-pr.mjs <task-slug>");
const repo = resolve(process.cwd());
function git(args) { const r = spawnSync("git", args, { cwd: repo, encoding: "utf8", shell: false, timeout: 15000 }); if (r.status !== 0) throw Error("Git check failed: " + args[0]); return r.stdout.trim(); }
if (resolve(git(["rev-parse", "--show-toplevel"])).toLowerCase() !== repo.toLowerCase()) throw Error("Run from repository root.");
const review = JSON.parse(await readFile(join(repo, "data", "jarvis-reviews", taskId + ".json"), "utf8"));
const verification = JSON.parse(await readFile(join(repo, "data", "jarvis-verifications", taskId + ".json"), "utf8"));
const draft = await readFile(join(repo, "data", "jarvis-pr-drafts", taskId + ".md"), "utf8");
const branch = "jarvis/" + taskId;
if (review.taskId !== taskId || verification.taskId !== taskId || review.branch !== branch || verification.branch !== branch || !verification.passed || !review.requiresHumanReview || review.headCommit !== verification.headCommit || git(["rev-parse", branch]) !== review.headCommit) throw Error("Review and verified commit must match.");
if (!Array.isArray(review.files) || !review.files.length || !draft.includes("Human code review")) throw Error("Missing review evidence.");
const remote = git(["remote", "get-url", "origin"]);
const match = remote.match(/(?:github\.com[:/])([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
if (!match) throw Error("Origin must be a GitHub repository.");
const [, owner, name] = match;
const remoteHead = git(["ls-remote", "--heads", "origin", branch]).split(/\s+/)[0];
if (remoteHead !== review.headCommit) throw Error("Verified task commit must be pushed to origin before PR creation.");
const title = "Jarvis: " + taskId.replaceAll("-", " ");
const request = { title, head: branch, base: "main", body: draft, draft: true, maintainer_can_modify: true };
if (process.env.JARVIS_PR_PUBLISH_ENABLED !== "true") {
  console.log(JSON.stringify({ mode: "dry_run", repo: owner + "/" + name, title, head: branch, base: "main", verifiedCommit: review.headCommit }));
  process.exit(0);
}
const token = process.env.GITHUB_TOKEN;
if (!token) throw Error("GITHUB_TOKEN required to publish a draft PR.");
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);
let response;
try { response = await fetch(`https://api.github.com/repos/${owner}/${name}/pulls`, { method: "POST", signal: controller.signal, headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" }, body: JSON.stringify(request) }); } finally { clearTimeout(timeout); }
if (!response.ok) throw Error("GitHub PR creation failed: HTTP " + response.status);
const result = await response.json();
if (!result?.html_url || !result?.draft) throw Error("Unexpected GitHub PR response.");
console.log(JSON.stringify({ mode: "draft_pr_created", url: result.html_url, number: result.number, requiresHumanReview: true }));
