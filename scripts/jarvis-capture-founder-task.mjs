import { mkdir, writeFile } from "node:fs/promises";

const task = (process.env.FOUNDER_TASK || "").trim();
if (task.length > 500) throw Error("Task too long");
if (/[\r\n]/.test(task)) throw Error("Task must be one line");

const sensitive = /\b(stripe|payment|billing|subscription|plaid|bank|account deletion|customer data|auth|login|password|token|secret|production|deploy|email|outreach|advertis|campaign)\b/i.test(task);
const brief = {
  requestedAt: new Date().toISOString(),
  request: task,
  mode: "proposal_only",
  execution: "not_started",
  reviewRequired: true,
  risk: sensitive ? "restricted_area" : "routine_review",
  approvalReason: sensitive ? "Potential impact on payments, authentication, banking, customer data, production or outreach." : "Human review required before any coding worker executes changes.",
  plan: task ? [
    "Locate the relevant Buxme source files and existing tests.",
    "Prepare a narrowly scoped change plan without modifying production.",
    "Define or update tests that demonstrate the requested behavior.",
    "Request approval before coding and creating a reviewable pull request."
  ] : [],
  acceptanceCriteria: task ? [
    "Requested behavior is reproducible and documented.",
    "Automated checks pass for the affected code.",
    "No production deployment or protected data changes occur.",
    "A human approves any proposed implementation before execution."
  ] : []
};
await mkdir("jarvis-output", { recursive: true });
await writeFile("jarvis-output/founder-task.json", JSON.stringify(brief, null, 2) + "\n");
if (task) {
  const summary = [
    "## Founder task for review",
    "",
    "Request: " + task,
    "Risk: " + brief.risk,
    "Execution: not started",
    "",
    "### Plan",
    ...brief.plan.map(x => "- " + x),
    "",
    "### Acceptance criteria",
    ...brief.acceptanceCriteria.map(x => "- " + x),
    "",
    "No code changes or deployment have been performed."
  ].join("\n");
  await writeFile("jarvis-output/founder-task.md", summary + "\n");
  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
  }
}
