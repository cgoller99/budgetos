/** Parse only the executor's exact ledger issue format. Issues are evidence claims, not independent proof of code changes. */
export function parseJarvisExecutionLedger(issues, allowedIds) {
  const allowed = new Set(allowedIds);
  const records = [];
  for (const issue of issues) {
    if (issue.pull_request || typeof issue.title !== "string" || !issue.title.startsWith("Jarvis execution: ")) continue;
    const taskId = issue.title.slice("Jarvis execution: ".length);
    if (!allowed.has(taskId) || typeof issue.body !== "string") continue;
    const executionId = issue.body.match(/^Execution ID: ([a-f0-9]{20})$/m)?.[1];
    const workflowRunId = issue.body.match(/^Workflow: (\d+)$/m)?.[1];
    if (!executionId || !workflowRunId) continue;
    records.push({ taskId, executionId, workflowRunId, issueNumber: issue.number, issueUrl: issue.html_url, recordedAt: issue.created_at, status: "ledger_recorded" });
  }
  return records;
}
