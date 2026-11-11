/** GitHub Issues is the durable, deduplicated queue for autonomous read-only findings. */
import { readFile, writeFile } from "node:fs/promises";
const repo = process.env.GITHUB_REPOSITORY || "cgoller99/budgetos";
const token = process.env.GITHUB_TOKEN;
if (!token) throw Error("GITHUB_TOKEN required for persistent queue.");
const [owner, name] = repo.split("/");
const base = `https://api.github.com/repos/${owner}/${name}`;
const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" };
async function api(path, method = "GET", body) {
  const response = await fetch(base + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw Error(`GitHub ${method} ${path}: HTTP ${response.status}`);
  return response.json();
}
const report = JSON.parse(await readFile("jarvis-output/priorities.json", "utf8"));
const existing = await api("/issues?state=all&per_page=100");
const findings = report.priorities.filter(p => typeof p.id === "string" && typeof p.title === "string").slice(0, 15);
const results = [];
for (const finding of findings) {
  const marker = `<!-- jarvis-signal:${finding.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80)} -->`;
  const match = existing.find(issue => !issue.pull_request && typeof issue.body === "string" && issue.body.includes(marker));
  if (match) {
    results.push({ id: finding.id, issue: match.number, status: match.state === "closed" ? "completed" : "existing", url: match.html_url });
    continue;
  }
  const body = [
    marker, "## Autonomous Jarvis finding", "",
    "Status: discovered / awaiting review", "Execution: not started", "",
    `Priority score: ${finding.score ?? "unknown"}`, "",
    `Proposed action: ${finding.proposedAction ?? "Review evidence"}`, "",
    "Evidence:", ...(Array.isArray(finding.evidence) ? finding.evidence.slice(0, 5).map(e => `- ${String(e).slice(0, 300)}`) : ["- See worker artifact"]),
    "", "This issue is a proposal only. No code, production, billing, or customer data was changed."
  ].join("\n");
  const created = await api("/issues", "POST", { title: `[Jarvis] ${finding.title.slice(0, 170)}`, body });
  results.push({ id: finding.id, issue: created.number, status: "discovered", url: created.html_url });
}
await writeFile("jarvis-output/persistent-queue.json", JSON.stringify({ mode: "review_only", results }, null, 2) + "\n");
console.log(`Jarvis queue: ${results.filter(r => r.status === "discovered").length} new, ${results.filter(r => r.status !== "discovered").length} existing/completed.`);
