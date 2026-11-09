/** Deterministic, review-only Jarvis multi-agent coordinator. */
const workers = Object.freeze({
  developer: { label: "Developer", capabilities: ["inspect_code", "propose_patch", "run_tests"], approval: "Founder approval before coding runs; no merge or deploy" },
  marketing: { label: "Marketing", capabilities: ["draft_content", "propose_campaign"], approval: "Founder approval before publishing, contacting anyone, or spending" },
  analytics: { label: "Analytics", capabilities: ["review_aggregated_metrics", "propose_experiments"], approval: "Read-only; no customer-level data access" },
  operations: { label: "Operations", capabilities: ["review_ci_status", "propose_incident_response"], approval: "Founder approval before infrastructure or production changes" },
});
const keywords = {
  developer: /\b(code|bug|fix|feature|ui|app|screen|build|test|typescript|github|pull request)\b/i,
  marketing: /\b(marketing|promot|ad|campaign|youtube|tiktok|social|content|email|outreach|growth)\b/i,
  analytics: /\b(analytics|revenue|users|downloads|conversion|retention|metrics|subscriptions|churn)\b/i,
  operations: /\b(operations|outage|deployment|deploy|vercel|incident|monitor|security|uptime|production)\b/i,
};
const sensitive = /\b(payment|stripe|plaid|bank|billing|auth|login|password|token|secret|customer data|personal data|delete account|deploy|production|publish|email|outreach|spend|advertis|campaign)\b/i;
export function coordinateJarvis(tasks) {
  if (!Array.isArray(tasks) || tasks.length > 100) throw Error("Expected at most 100 tasks");
  const assigned = tasks.map((entry, index) => {
    const title = typeof entry === "string" ? entry : entry?.title;
    if (typeof title !== "string" || title.trim().length < 3 || title.length > 500 || /[\r\n]/.test(title)) throw Error("Invalid task at index " + index);
    const matches = Object.entries(keywords).filter(([, regex]) => regex.test(title)).map(([name]) => name);
    const agent = matches.length === 1 ? matches[0] : null;
    const restricted = sensitive.test(title);
    return {
      id: "proposal-" + (index + 1),
      title: title.trim(),
      agent,
      status: agent ? "needs_approval" : "needs_triage",
      risk: restricted ? "restricted" : "review_required",
      capabilities: agent ? workers[agent].capabilities : [],
      nextAction: agent ? "Prepare a reviewable plan; do not execute." : "Founder must select a specialist.",
      execution: "not_started",
    };
  });
  return { mode: "proposal_only", generatedAt: new Date().toISOString(), workers, tasks: assigned, executed: false };
}
