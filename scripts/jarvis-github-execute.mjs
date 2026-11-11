/** GitHub Issues is the durable completed-task ledger across ephemeral runners. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
const token = process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPOSITORY;
if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repo || "")) throw Error("GitHub credentials/repository required; fail closed");
const endpoint = "https://api.github.com/repos/" + repo;
async function api(path, options = {}) {
  const response = await fetch(endpoint + path, { ...options, headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" } });
  if (!response.ok) throw Error("GitHub API failed: " + response.status);
  return response.json();
}
const manifest = JSON.parse(await readFile("data/jarvis-approved-tasks.json", "utf8"));
if (!Array.isArray(manifest)) throw Error("Invalid manifest");
const completed = new Set();
for (let page = 1; page <= 20; page++) {
  const issues = await api("/issues?state=all&per_page=100&page=" + page);
  for (const issue of issues) if (!issue.pull_request && issue.title?.startsWith("Jarvis execution: ")) completed.add(issue.title.slice("Jarvis execution: ".length));
  if (issues.length < 100) break;
  if (page === 20) throw Error("Issue ledger exceeds scan limit; fail closed");
}
const task = manifest.find(x => x.status === "approved" && !completed.has(x.id));
if (!task) { console.log("No new approved tasks; no execution."); } else {
const queuePath = process.env.JARVIS_QUEUE_PATH;
if (!queuePath) throw Error("Isolated queue path required");
await mkdir(dirname(queuePath), { recursive: true });
await writeFile(queuePath, JSON.stringify([task]));
const run = spawnSync(process.execPath, ["scripts/jarvis-execute.mjs"], { encoding: "utf8", env: process.env });
process.stdout.write(run.stdout); process.stderr.write(run.stderr);
if (run.status !== 0) throw Error("Jarvis executor failed: " + run.status);
const updated = JSON.parse(await readFile(queuePath, "utf8"))[0];
if (updated.status !== "completed") throw Error("Task was not completed");
await api("/issues", { method: "POST", body: JSON.stringify({ title: "Jarvis execution: " + task.id, body: "Read-only Jarvis execution completed.\n\nAgent: " + updated.agent + "\nAction: " + updated.action + "\nCompleted: " + updated.completedAt + "\nExecution ID: " + updated.executionId + "\nWorkflow: " + process.env.GITHUB_RUN_ID + "\n\nSee workflow artifact for evidence." }) });
console.log("Durable execution ledger created for " + task.id);
}
