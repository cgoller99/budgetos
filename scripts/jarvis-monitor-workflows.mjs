/** Read-only GitHub workflow monitor. It creates signals, never dispatches workflows. */
import { writeFile, mkdir } from "node:fs/promises";
const repo = process.env.GITHUB_REPOSITORY || "cgoller99/budgetos";
const token = process.env.GITHUB_TOKEN;
const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
const workflows = ["jarvis-proposals.yml", "jarvis-coding-review.yml"];
const signals = [];
for (const workflow of workflows) {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/runs?per_page=10`, { headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw Error(`HTTP ${res.status}`);
    const data = await res.json();
    const runs = data.workflow_runs || [];
    const failed = runs.filter(r => (r.conclusion === "failure" || r.conclusion === "timed_out") && Date.now() - Date.parse(r.created_at) < 24 * 60 * 60 * 1000);
    if (failed.length) {
      const latest = failed[0];
      signals.push({
        id: `github-failures-${workflow}`,
        title: `Investigate ${failed.length} recent failed ${workflow} runs`,
        source: "reliability", severity: 4, affectedUsers: 0, confidence: 1,
        evidence: [`GitHub Actions run ${latest.id}: ${latest.html_url}`],
        proposedAction: "Review failed workflow logs and prepare a non-sensitive fix proposal for founder review"
      });
    }
    if (workflow === "jarvis-proposals.yml" && runs.length && !runs.some(r => r.event === "schedule" && Date.now() - Date.parse(r.created_at) < 60 * 60 * 1000)) {
      signals.push({
        id: "github-stale-jarvis-schedule",
        title: "Jarvis scheduled worker has not run within the last hour",
        source: "reliability", severity: 4, affectedUsers: 0, confidence: 1,
        evidence: [`Latest workflow run: ${runs[0].html_url} at ${runs[0].created_at}`],
        proposedAction: "Inspect GitHub Actions schedule status and default branch configuration; prepare a review-only fix"
      });
    }
    if (!runs.length) signals.push({
      id: `github-no-runs-${workflow}`, title: `Verify ${workflow} has been activated`,
      source: "reliability", severity: 2, affectedUsers: 0, confidence: 1,
      evidence: [`GitHub API returned zero runs for ${workflow}`],
      proposedAction: "Review workflow activation and configuration; do not trigger execution automatically"
    });
  } catch (error) {
    signals.push({
      id: `github-unavailable-${workflow}`, title: `GitHub monitoring unavailable for ${workflow}`,
      source: "reliability", severity: 2, affectedUsers: 0, confidence: 0.6,
      evidence: [String(error).slice(0, 200)],
      proposedAction: "Check GitHub API access and retry read-only monitoring"
    });
  }
}
await mkdir("jarvis-output", { recursive: true });
await writeFile("jarvis-output/live-signals.json", JSON.stringify(signals, null, 2) + "\n");
console.log(`Jarvis observed ${signals.length} actionable workflow signals without changing GitHub.`);
